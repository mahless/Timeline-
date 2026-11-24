import {
  GREGORIAN_MONTH_NAMES,
  getGregorianDaysInMonth,
  gregorianToHijri,
  hijriToGregorian,
} from './hijri';
import {
  buildSortDateKey,
  classifyTemporalPosition,
  formatEventGregorianDate,
} from './timeline';
import type {
  Category,
  CategoryColorKey,
  DateParts,
  RecurrenceFrequency,
  ReminderOffset,
  ReminderRule,
  TimelineEvent,
} from './types';

export interface UpcomingOccurrence {
  event: TimelineEvent;
  occurrenceDateKey: string; // YYYY-MM-DD
  gregorianFormatted: string;
  hijriFormatted: string;
  daysRemaining: number;
  countdownLabel: string;
  isRecurringInstance: boolean;
  isToday: boolean;
}

export interface OnThisDayMemory {
  event: TimelineEvent;
  matchType: 'gregorian' | 'hijri' | 'both';
  yearsAgo: number;
}

export interface DueReminderItem {
  key: string; // `${event.id}::${occurrenceDateKey}::${reminder.id}`
  event: TimelineEvent;
  reminder: ReminderRule;
  occurrenceDateKey: string;
  triggerDateKey: string;
  labelAr: string;
}

export interface DashboardSummary {
  totalCount: number;
  pastCount: number;
  futureCount: number;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
  pinnedUpcoming: UpcomingOccurrence[];
  nearestUpcoming: UpcomingOccurrence[];
  todayOccurrences: UpcomingOccurrence[];
}

export interface ArchiveStatistics {
  byYear: Array<{ year: number; count: number }>;
  byCategory: Array<{
    categoryId: string;
    name: string;
    colorKey: CategoryColorKey;
    count: number;
    percentage: number;
  }>;
  byMonthActivity: Array<{ month: number; name: string; count: number }>;
  mostActiveYear: { year: number; count: number } | null;
  mostActiveMonth: { month: number; name: string; count: number } | null;
  recurringCount: number;
  pinnedCount: number;
  attachmentsTotalCount: number;
}

function toUtcMs(parts: DateParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function parseDateKey(dateKey: string): DateParts {
  const [y, m, d] = dateKey.split('-').map((n) => parseInt(n, 10));
  return { year: y, month: m || 1, day: d || 1 };
}

function diffDays(target: DateParts, today: DateParts): number {
  return Math.round((toUtcMs(target) - toUtcMs(today)) / 86_400_000);
}

export function formatCountdownLabel(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'اليوم';
  if (daysRemaining === 1) return 'غدًا (متبقي يوم واحد)';
  if (daysRemaining === 2) return 'بعد يومين';
  if (daysRemaining <= 10) return `متبقي ${daysRemaining} أيام`;
  if (daysRemaining < 30) return `متبقي ${daysRemaining} يومًا`;

  const months = Math.floor(daysRemaining / 30);
  const remDays = daysRemaining % 30;
  if (months < 12) {
    const mUnit =
      months === 1 ? 'شهر' : months === 2 ? 'شهران' : months <= 10 ? `${months} أشهر` : `${months} شهرًا`;
    if (remDays === 0) return `متبقي ${mUnit}`;
    const dUnit = remDays === 1 ? 'يوم' : remDays === 2 ? 'يومان' : remDays <= 10 ? `${remDays} أيام` : `${remDays} يومًا`;
    return `متبقي ${mUnit} و ${dUnit}`;
  }

  const years = Math.floor(daysRemaining / 365);
  const remMonths = Math.floor((daysRemaining % 365) / 30);
  const yUnit = years === 1 ? 'سنة' : years === 2 ? 'سنتان' : years <= 10 ? `${years} سنوات` : `${years} سنة`;
  if (remMonths === 0) return `متبقي ${yUnit}`;
  const mUnit = remMonths === 1 ? 'شهر' : remMonths === 2 ? 'شهران' : remMonths <= 10 ? `${remMonths} أشهر` : `${remMonths} شهرًا`;
  return `متبقي ${yUnit} و ${mUnit}`;
}

export const RECURRENCE_LABELS: Record<RecurrenceFrequency, string> = {
  daily: 'يومي',
  weekly: 'أسبوعي',
  monthly: 'شهري',
  yearly: 'سنوي',
};

export const REMINDER_OFFSET_LABELS: Record<ReminderOffset, string> = {
  same_day: 'في نفس اليوم',
  day_before: 'قبل الموعد بيوم',
  week_before: 'قبل الموعد بأسبوع',
  month_before: 'قبل الموعد بشهر',
};

/**
 * Computes the next occurrence date (>= today) for a recurring or single event.
 */
export function getNextOccurrence(
  event: TimelineEvent,
  today: DateParts,
): UpcomingOccurrence | null {
  const todayKey = buildSortDateKey(today.year, today.month, today.day);

  if (!event.recurrence) {
    const pos = classifyTemporalPosition(event, today);
    if (pos === 'past') return null;

    const targetParts: DateParts = {
      year: event.gregorianYear,
      month: event.gregorianMonth ?? (pos === 'today' ? today.month : 1),
      day: event.gregorianDay ?? (pos === 'today' ? today.day : 1),
    };
    const occKey = buildSortDateKey(targetParts.year, targetParts.month, targetParts.day);
    const daysRemaining = Math.max(0, diffDays(targetParts, today));

    return {
      event,
      occurrenceDateKey: occKey,
      gregorianFormatted: formatEventGregorianDate(event),
      hijriFormatted: event.hijriFormatted,
      daysRemaining,
      countdownLabel: formatCountdownLabel(daysRemaining),
      isRecurringInstance: false,
      isToday: pos === 'today',
    };
  }

  // Recurring event calculation
  const { frequency, calendar, endDate } = event.recurrence;
  const startKey = event.sortDateKey;

  let candidateParts: DateParts;

  if (startKey >= todayKey) {
    candidateParts = parseDateKey(startKey);
  } else if (frequency === 'daily') {
    candidateParts = { ...today };
  } else if (frequency === 'weekly') {
    const startMs = toUtcMs(parseDateKey(startKey));
    const todayMs = toUtcMs(today);
    const diff = Math.floor((todayMs - startMs) / 86_400_000);
    const rem = diff % 7;
    const addDays = rem === 0 ? 0 : 7 - rem;
    const nextDt = new Date(todayMs + addDays * 86_400_000);
    candidateParts = {
      year: nextDt.getUTCFullYear(),
      month: nextDt.getUTCMonth() + 1,
      day: nextDt.getUTCDate(),
    };
  } else if (calendar === 'gregorian') {
    const anchorMonth = event.gregorianMonth ?? 1;
    const anchorDay = event.gregorianDay ?? 1;

    if (frequency === 'monthly') {
      let y = today.year;
      let m = today.month;
      let d = Math.min(anchorDay, getGregorianDaysInMonth(y, m));
      if (buildSortDateKey(y, m, d) < todayKey) {
        m += 1;
        if (m > 12) {
          m = 1;
          y += 1;
        }
        d = Math.min(anchorDay, getGregorianDaysInMonth(y, m));
      }
      candidateParts = { year: y, month: m, day: d };
    } else {
      // yearly Gregorian
      let y = today.year;
      let d = Math.min(anchorDay, getGregorianDaysInMonth(y, anchorMonth));
      if (buildSortDateKey(y, anchorMonth, d) < todayKey) {
        y += 1;
        d = Math.min(anchorDay, getGregorianDaysInMonth(y, anchorMonth));
      }
      candidateParts = { year: y, month: anchorMonth, day: d };
    }
  } else {
    // Hijri monthly or yearly recurrence
    const todayHijri = gregorianToHijri('exact', today.year, today.month, today.day);
    const anchorHMonth = event.hijriMonth ?? 1;
    const anchorHDay = event.hijriDay ?? 1;

    if (frequency === 'monthly') {
      let hy = todayHijri.hijriYear;
      let hm = todayHijri.hijriMonth ?? 1;
      let converted = hijriToGregorian('exact', hy, hm, Math.min(anchorHDay, 29));
      // Try exact anchorHDay first
      const exactTry = hijriToGregorian('exact', hy, hm, anchorHDay);
      const exactKey = buildSortDateKey(exactTry.year, exactTry.month, exactTry.day);
      if (exactKey >= todayKey) {
        converted = exactTry;
      } else {
        hm += 1;
        if (hm > 12) {
          hm = 1;
          hy += 1;
        }
        converted = hijriToGregorian('exact', hy, hm, anchorHDay);
      }
      candidateParts = {
        year: converted.year,
        month: converted.month ?? 1,
        day: converted.day ?? 1,
      };
    } else {
      // yearly Hijri
      let hy = todayHijri.hijriYear;
      let converted = hijriToGregorian('exact', hy, anchorHMonth, anchorHDay);
      const tryKey = buildSortDateKey(converted.year, converted.month, converted.day);
      if (tryKey < todayKey) {
        hy += 1;
        converted = hijriToGregorian('exact', hy, anchorHMonth, anchorHDay);
      }
      candidateParts = {
        year: converted.year,
        month: converted.month ?? 1,
        day: converted.day ?? 1,
      };
    }
  }

  const occKey = buildSortDateKey(candidateParts.year, candidateParts.month, candidateParts.day);
  if (endDate && occKey > endDate) {
    return null;
  }

  const daysRemaining = Math.max(0, diffDays(candidateParts, today));
  const h = gregorianToHijri('exact', candidateParts.year, candidateParts.month, candidateParts.day);

  return {
    event,
    occurrenceDateKey: occKey,
    gregorianFormatted: formatEventGregorianDate({
      datePrecision: 'exact',
      gregorianYear: candidateParts.year,
      gregorianMonth: candidateParts.month,
      gregorianDay: candidateParts.day,
    }),
    hijriFormatted: h.formattedAr,
    daysRemaining,
    countdownLabel: formatCountdownLabel(daysRemaining),
    isRecurringInstance: occKey !== startKey,
    isToday: daysRemaining === 0,
  };
}

export function getUpcomingOccurrences(
  events: TimelineEvent[],
  today: DateParts,
): UpcomingOccurrence[] {
  const list: UpcomingOccurrence[] = [];
  for (const ev of events) {
    const occ = getNextOccurrence(ev, today);
    if (occ) list.push(occ);
  }
  return list.sort((a, b) => {
    const pinA = a.event.isPinned ? 0 : 1;
    const pinB = b.event.isPinned ? 0 : 1;
    if (pinA !== pinB) return pinA - pinB;
    if (a.daysRemaining !== b.daysRemaining) return a.daysRemaining - b.daysRemaining;
    return a.occurrenceDateKey.localeCompare(b.occurrenceDateKey);
  });
}

export function getOnThisDayMemories(
  events: TimelineEvent[],
  today: DateParts,
): OnThisDayMemory[] {
  const todayHijri = gregorianToHijri('exact', today.year, today.month, today.day);
  const results: OnThisDayMemory[] = [];

  for (const ev of events) {
    if (ev.datePrecision !== 'exact') continue;

    const matchGregorian =
      ev.gregorianYear < today.year &&
      ev.gregorianMonth === today.month &&
      ev.gregorianDay === today.day;

    const matchHijri =
      ev.hijriYear < todayHijri.hijriYear &&
      ev.hijriMonth === todayHijri.hijriMonth &&
      ev.hijriDay === todayHijri.hijriDay;

    if (!matchGregorian && !matchHijri) continue;

    const matchType: OnThisDayMemory['matchType'] =
      matchGregorian && matchHijri ? 'both' : matchGregorian ? 'gregorian' : 'hijri';

    const yearsAgo = matchGregorian
      ? today.year - ev.gregorianYear
      : todayHijri.hijriYear - ev.hijriYear;

    results.push({ event: ev, matchType, yearsAgo });
  }

  return results.sort((a, b) => a.yearsAgo - b.yearsAgo);
}

export function computeReminderTriggerDateKey(
  occurrenceDateKey: string,
  offset: ReminderOffset,
): string {
  const parts = parseDateKey(occurrenceDateKey);
  if (offset === 'same_day') return occurrenceDateKey;

  if (offset === 'day_before') {
    const dt = new Date(toUtcMs(parts) - 86_400_000);
    return buildSortDateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  if (offset === 'week_before') {
    const dt = new Date(toUtcMs(parts) - 7 * 86_400_000);
    return buildSortDateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }

  // month_before
  let y = parts.year;
  let m = parts.month - 1;
  if (m < 1) {
    m = 12;
    y -= 1;
  }
  const d = Math.min(parts.day, getGregorianDaysInMonth(y, m));
  return buildSortDateKey(y, m, d);
}

export function getDueReminders(
  events: TimelineEvent[],
  today: DateParts,
  dismissedKeys: Set<string>,
): DueReminderItem[] {
  const todayKey = buildSortDateKey(today.year, today.month, today.day);
  const due: DueReminderItem[] = [];

  for (const ev of events) {
    if (!ev.reminders || ev.reminders.length === 0) continue;
    const occ = getNextOccurrence(ev, today);
    if (!occ) continue;

    for (const rem of ev.reminders) {
      const triggerKey = computeReminderTriggerDateKey(occ.occurrenceDateKey, rem.offset);
      if (triggerKey <= todayKey && occ.occurrenceDateKey >= todayKey) {
        const key = `${ev.id}::${occ.occurrenceDateKey}::${rem.id}`;
        if (!dismissedKeys.has(key)) {
          due.push({
            key,
            event: ev,
            reminder: rem,
            occurrenceDateKey: occ.occurrenceDateKey,
            triggerDateKey: triggerKey,
            labelAr: REMINDER_OFFSET_LABELS[rem.offset],
          });
        }
      }
    }
  }

  return due.sort((a, b) => a.occurrenceDateKey.localeCompare(b.occurrenceDateKey));
}

export function computeDashboardSummary(
  events: TimelineEvent[],
  today: DateParts,
): DashboardSummary {
  let pastCount = 0;
  let futureCount = 0;
  let todayCount = 0;

  for (const ev of events) {
    const pos = classifyTemporalPosition(ev, today);
    if (pos === 'past') pastCount++;
    else if (pos === 'future') futureCount++;
    else todayCount++;
  }

  const upcoming = getUpcomingOccurrences(events, today);
  const todayOccurrences = upcoming.filter((o) => o.isToday);
  const thisWeekCount = upcoming.filter((o) => o.daysRemaining <= 7).length;
  const thisMonthCount = upcoming.filter((o) => o.daysRemaining <= 30).length;

  const pinnedUpcoming = upcoming.filter((o) => o.event.isPinned && !o.isToday);
  const nearestUpcoming = upcoming
    .filter((o) => !o.isToday)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 5);

  return {
    totalCount: events.length,
    pastCount,
    futureCount,
    todayCount,
    thisWeekCount,
    thisMonthCount,
    pinnedUpcoming,
    nearestUpcoming,
    todayOccurrences,
  };
}

export function computeArchiveStatistics(
  events: TimelineEvent[],
  categories: Category[],
): ArchiveStatistics {
  const yearCounts = new Map<number, number>();
  const catCounts = new Map<string, number>();
  const monthCounts = new Map<number, number>();

  let recurringCount = 0;
  let pinnedCount = 0;
  let attachmentsTotalCount = 0;

  for (const ev of events) {
    yearCounts.set(ev.gregorianYear, (yearCounts.get(ev.gregorianYear) ?? 0) + 1);
    catCounts.set(ev.categoryId, (catCounts.get(ev.categoryId) ?? 0) + 1);
    if (ev.gregorianMonth) {
      monthCounts.set(ev.gregorianMonth, (monthCounts.get(ev.gregorianMonth) ?? 0) + 1);
    }
    if (ev.recurrence) recurringCount++;
    if (ev.isPinned) pinnedCount++;
    attachmentsTotalCount += ev.attachmentIds.length;
  }

  const byYear = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  const total = events.length || 1;
  const byCategory = categories
    .map((cat) => {
      const count = catCounts.get(cat.id) ?? 0;
      return {
        categoryId: cat.id,
        name: cat.name,
        colorKey: cat.colorKey,
        count,
        percentage: Math.round((count / total) * 100),
      };
    })
    .sort((a, b) => b.count - a.count);

  const byMonthActivity = GREGORIAN_MONTH_NAMES.map((name, idx) => ({
    month: idx + 1,
    name,
    count: monthCounts.get(idx + 1) ?? 0,
  }));

  const mostActiveYear =
    byYear.length > 0
      ? [...byYear].sort((a, b) => b.count - a.count)[0]
      : null;

  const activeMonths = byMonthActivity.filter((m) => m.count > 0);
  const mostActiveMonth =
    activeMonths.length > 0
      ? [...activeMonths].sort((a, b) => b.count - a.count)[0]
      : null;

  return {
    byYear,
    byCategory,
    byMonthActivity,
    mostActiveYear,
    mostActiveMonth,
    recurringCount,
    pinnedCount,
    attachmentsTotalCount,
  };
}
