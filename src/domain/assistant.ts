import { formatEventGregorianDate, matchesArabicToken, normalizeArabic } from './timeline';
import type { Category, EventThread, TimelineEvent } from './types';

export interface CompactEventContext {
  id: string;
  title: string;
  gregorianDate: string;
  hijriDate: string;
  sortDateKey: string;
  time?: string;
  category: string;
  thread?: string;
  location?: string;
  description: string;
  keywords: string[];
  isPinned: boolean;
  recurrence?: string;
}

export interface SemanticSearchHit {
  event: TimelineEvent;
  score: number;
  matchedConcepts: string[];
}

const RAW_ARABIC_CONCEPT_CLUSTERS: string[][] = [
  ['عمل', 'وظيفة', 'شغل', 'مهني', 'توظيف', 'مشروع', 'عقد', 'مكتب', 'شركة', 'ترقية', 'راتب', 'تخرج'],
  ['سفر', 'رحلة', 'طيران', 'جواز', 'مطار', 'إجازة', 'سياحة', 'فندق', 'تأشيرة'],
  ['مال', 'مالي', 'ادخار', 'ميزانية', 'بنك', 'استثمار', 'شراء', 'بيع', 'مصروف', 'دخل'],
  ['عائلة', 'عائلي', 'أسرة', 'زواج', 'مولود', 'والد', 'والدة', 'أخ', 'أخت', 'بيت', 'منزل'],
  ['دين', 'ديني', 'عمرة', 'حج', 'رمضان', 'عيد', 'مسجد', 'صيام', 'زكاة'],
  ['صحة', 'طبيب', 'مستشفى', 'علاج', 'عملية', 'فحص', 'دواء', 'رياضة'],
  ['دراسة', 'تعليم', 'جامعة', 'شهادة', 'دورة', 'امتحان', 'تخرج', 'بحث'],
];

const ARABIC_CONCEPT_CLUSTERS: string[][] = RAW_ARABIC_CONCEPT_CLUSTERS.map((cluster) =>
  Array.from(new Set(cluster.map((w) => normalizeArabic(w)))),
);

export function buildMemoryContextForAI(
  events: TimelineEvent[],
  categoriesMap: Map<string, Category>,
  threadsMap: Map<string, EventThread>,
  maxEvents = 180,
): CompactEventContext[] {
  const sorted = [...events].sort((a, b) => b.sortDateKey.localeCompare(a.sortDateKey));
  return sorted.slice(0, maxEvents).map((ev) => ({
    id: ev.id,
    title: ev.title,
    gregorianDate: formatEventGregorianDate(ev),
    hijriDate: ev.hijriFormatted,
    sortDateKey: ev.sortDateKey,
    time: ev.time,
    category: categoriesMap.get(ev.categoryId)?.name ?? 'عام',
    thread: ev.threadId ? threadsMap.get(ev.threadId)?.title : undefined,
    location: ev.location,
    description: ev.description,
    keywords: ev.keywords,
    isPinned: !!ev.isPinned,
    recurrence: ev.recurrence
      ? `${ev.recurrence.frequency} (${ev.recurrence.calendar})`
      : undefined,
  }));
}

function expandSemanticTokens(rawQuery: string): { directTokens: string[]; expandedTokens: string[] } {
  const norm = normalizeArabic(rawQuery);
  const directTokens = norm.split(/\s+/).filter((t) => t.length >= 2);
  const expanded = new Set<string>(directTokens);

  for (const token of directTokens) {
    const stem = token.startsWith('ال') && token.length >= 4 ? token.slice(2) : token;
    for (const cluster of ARABIC_CONCEPT_CLUSTERS) {
      if (
        cluster.some(
          (word) =>
            word.includes(token) ||
            token.includes(word) ||
            word.includes(stem) ||
            stem.includes(word),
        )
      ) {
        for (const synonym of cluster) {
          expanded.add(synonym);
        }
      }
    }
  }

  return {
    directTokens,
    expandedTokens: Array.from(expanded),
  };
}

/**
 * Offline Arabic conceptual/semantic search across all fields of the user's archive.
 */
export function searchEventsSemanticOffline(
  events: TimelineEvent[],
  categoriesMap: Map<string, Category>,
  threadsMap: Map<string, EventThread>,
  query: string,
): SemanticSearchHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { directTokens, expandedTokens } = expandSemanticTokens(trimmed);
  if (expandedTokens.length === 0) return [];

  const hits: SemanticSearchHit[] = [];

  for (const ev of events) {
    const catName = categoriesMap.get(ev.categoryId)?.name ?? '';
    const threadTitle = ev.threadId ? (threadsMap.get(ev.threadId)?.title ?? '') : '';
    const titleNorm = normalizeArabic(ev.title);
    const descNorm = normalizeArabic(ev.description);
    const metaNorm = normalizeArabic(
      [
        catName,
        threadTitle,
        ev.location ?? '',
        ev.hijriFormatted,
        formatEventGregorianDate(ev),
        ev.keywords.join(' '),
      ].join(' '),
    );

    let score = 0;
    const matched = new Set<string>();

    for (const token of directTokens) {
      if (matchesArabicToken(titleNorm, token)) {
        score += 5;
        matched.add(token);
      }
      if (matchesArabicToken(metaNorm, token)) {
        score += 3;
        matched.add(token);
      }
      if (matchesArabicToken(descNorm, token)) {
        score += 2;
        matched.add(token);
      }
    }

    for (const syn of expandedTokens) {
      if (directTokens.includes(syn)) continue;
      if (
        matchesArabicToken(titleNorm, syn) ||
        matchesArabicToken(metaNorm, syn) ||
        matchesArabicToken(descNorm, syn)
      ) {
        score += 1.5;
        matched.add(syn);
      }
    }

    if (score > 0) {
      hits.push({
        event: ev,
        score,
        matchedConcepts: Array.from(matched).slice(0, 5),
      });
    }
  }

  return hits.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.event.sortDateKey.localeCompare(a.event.sortDateKey);
  });
}
