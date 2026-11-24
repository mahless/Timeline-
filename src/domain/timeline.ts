import {
  GREGORIAN_MONTH_NAMES,
  formatHijriParts,
  getGregorianDaysInMonth,
  gregorianToHijri,
  hijriToGregorian,
} from './hijri';
import type {
  Category,
  DateParts,
  EventFormInput,
  EventThread,
  MonthGroup,
  TemporalPosition,
  TimelineEvent,
  TimelineFilters,
  TimelineHorizonResult,
  YearGroup,
} from './types';

export function getTodayParts(now = new Date()): DateParts {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

export function normalizeArabic(input: string): string {
  return input
    // Convert Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to ASCII (0-9)
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0))
    // Remove Arabic diacritics, tashkeel, koranic annotation marks, and tatweel/kashida (ـ)
    .replace(/[\u0610-\u061A\u0640\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    // Unify all Alef forms (أ إ آ ٱ) -> ا
    .replace(/[أإآٱ]/g, 'ا')
    // Unify Taa Marbuta (ة) -> ه
    .replace(/ة/g, 'ه')
    // Unify Alef Maksura (ى) and Hamza-on-Yaa (ئ) -> ي
    .replace(/[ىئ]/g, 'ي')
    // Unify Waw-with-Hamza (ؤ) -> و
    .replace(/ؤ/g, 'و')
    // Remove standalone Hamza (ء) so قراءة / قراءه / قراه and شيء / شئ / شي match cleanly
    .replace(/ء/g, '')
    // Normalize Arabic punctuation (، ؛ ؟) and collapse extra whitespace
    .replace(/[،؛؟]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function matchesArabicToken(normalizedHaystack: string, normalizedToken: string): boolean {
  if (!normalizedToken) return true;
  if (normalizedHaystack.includes(normalizedToken)) return true;

  // Match queries starting with definite article "ال" against indefinite or prepositional forms
  if (normalizedToken.startsWith('ال') && normalizedToken.length >= 4) {
    const withoutAl = normalizedToken.slice(2);
    if (normalizedHaystack.includes(withoutAl)) return true;
  }

  // Match queries prefixed with conjunction "و" (e.g., "والعائله" -> "العائله" / "عائله")
  if (normalizedToken.startsWith('و') && normalizedToken.length >= 4) {
    const withoutWaw = normalizedToken.slice(1);
    if (matchesArabicToken(normalizedHaystack, withoutWaw)) return true;
  }

  return false;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildSortDateKey(year: number, month?: number, day?: number): string {
  const y = String(year).padStart(4, '0');
  const m = pad2(month ?? 1);
  const d = pad2(day ?? 1);
  return `${y}-${m}-${d}`;
}

export function classifyTemporalPosition(
  event: Pick<TimelineEvent, 'datePrecision' | 'gregorianYear' | 'gregorianMonth' | 'gregorianDay'>,
  today: DateParts,
): TemporalPosition {
  if (event.gregorianYear < today.year) return 'past';
  if (event.gregorianYear > today.year) return 'future';

  if (event.datePrecision === 'year') {
    return 'today';
  }

  const m = event.gregorianMonth ?? 1;
  if (m < today.month) return 'past';
  if (m > today.month) return 'future';

  if (event.datePrecision === 'month') {
    return 'today';
  }

  const d = event.gregorianDay ?? 1;
  if (d < today.day) return 'past';
  if (d > today.day) return 'future';
  return 'today';
}

export function formatEventGregorianDate(
  event: Pick<TimelineEvent, 'datePrecision' | 'gregorianYear' | 'gregorianMonth' | 'gregorianDay'>,
): string {
  if (event.datePrecision === 'year') {
    return `عام ${event.gregorianYear} (تقريبي)`;
  }
  if (event.datePrecision === 'month' && event.gregorianMonth) {
    const monthName = GREGORIAN_MONTH_NAMES[event.gregorianMonth - 1] ?? `${event.gregorianMonth}`;
    return `${monthName} ${event.gregorianYear} (تقريبي)`;
  }
  if (event.gregorianMonth && event.gregorianDay) {
    const monthName = GREGORIAN_MONTH_NAMES[event.gregorianMonth - 1] ?? `${event.gregorianMonth}`;
    return `${event.gregorianDay} ${monthName} ${event.gregorianYear}`;
  }
  return `${event.gregorianYear}`;
}

export function formatTodayHeader(today: DateParts): { gregorian: string; hijri: string } {
  const monthName = GREGORIAN_MONTH_NAMES[today.month - 1] ?? '';
  const hijri = gregorianToHijri('exact', today.year, today.month, today.day);
  return {
    gregorian: `${today.day} ${monthName} ${today.year}`,
    hijri: hijri.formattedAr,
  };
}

export function getRelativeTimeLabel(
  event: Pick<TimelineEvent, 'datePrecision' | 'gregorianYear' | 'gregorianMonth' | 'gregorianDay'>,
  today: DateParts,
): string {
  const pos = classifyTemporalPosition(event, today);

  if (event.datePrecision === 'year') {
    if (pos === 'today') return 'خلال هذا العام';
    const diffY = Math.abs(event.gregorianYear - today.year);
    const unit = diffY === 1 ? 'سنة' : diffY === 2 ? 'سنتين' : diffY <= 10 ? `${diffY} سنوات` : `${diffY} سنة`;
    return pos === 'future' ? `بعد ${unit} تقريبًا` : `منذ ${unit} تقريبًا`;
  }

  if (event.datePrecision === 'month') {
    if (pos === 'today') return 'خلال هذا الشهر';
    const totalMonthsEvent = event.gregorianYear * 12 + (event.gregorianMonth ?? 1);
    const totalMonthsToday = today.year * 12 + today.month;
    const diffM = Math.abs(totalMonthsEvent - totalMonthsToday);
    if (diffM >= 12) {
      const years = Math.floor(diffM / 12);
      const unit = years === 1 ? 'سنة' : years === 2 ? 'سنتين' : years <= 10 ? `${years} سنوات` : `${years} سنة`;
      return pos === 'future' ? `بعد ${unit} تقريبًا` : `منذ ${unit} تقريبًا`;
    }
    const unit = diffM === 1 ? 'شهر' : diffM === 2 ? 'شهرين' : diffM <= 10 ? `${diffM} أشهر` : `${diffM} شهرًا`;
    return pos === 'future' ? `بعد ${unit} تقريبًا` : `منذ ${unit} تقريبًا`;
  }

  if (pos === 'today') return 'اليوم';

  const eventUtc = Date.UTC(event.gregorianYear, (event.gregorianMonth ?? 1) - 1, event.gregorianDay ?? 1);
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  const diffDays = Math.round(Math.abs(eventUtc - todayUtc) / 86_400_000);

  if (diffDays === 1) return pos === 'future' ? 'غدًا' : 'أمس';
  if (diffDays === 2) return pos === 'future' ? 'بعد يومين' : 'منذ يومين';
  if (diffDays < 30) {
    const unit = diffDays <= 10 ? `${diffDays} أيام` : `${diffDays} يومًا`;
    return pos === 'future' ? `بعد ${unit}` : `منذ ${unit}`;
  }
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    const unit = months === 1 ? 'شهر' : months === 2 ? 'شهرين' : months <= 10 ? `${months} أشهر` : `${months} شهرًا`;
    return pos === 'future' ? `بعد ${unit}` : `منذ ${unit}`;
  }
  const years = Math.floor(diffDays / 365);
  const unit = years === 1 ? 'سنة' : years === 2 ? 'سنتين' : years <= 10 ? `${years} سنوات` : `${years} سنة`;
  return pos === 'future' ? `بعد ${unit}` : `منذ ${unit}`;
}

export function validateEventInput(input: EventFormInput): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const trimmedTitle = input.title.trim();

  if (!trimmedTitle) {
    errors.title = 'عنوان الحدث مطلوب.';
  } else if (trimmedTitle.length > 160) {
    errors.title = 'يجب ألا يتجاوز عنوان الحدث 160 حرفًا.';
  }

  if (input.calendarInput === 'gregorian') {
    if (!Number.isInteger(input.year) || input.year < 1900 || input.year > 2150) {
      errors.date = 'السنة الميلادية يجب أن تكون بين 1900 و 2150.';
    } else if (input.datePrecision !== 'year') {
      if (!input.month || input.month < 1 || input.month > 12) {
        errors.date = 'يرجى اختيار شهر صحيح.';
      } else if (input.datePrecision === 'exact') {
        const maxDay = getGregorianDaysInMonth(input.year, input.month);
        if (!input.day || input.day < 1 || input.day > maxDay) {
          errors.date = `اليوم غير صحيح لهذا الشهر (1 - ${maxDay}).`;
        }
      }
    }
  } else {
    if (!Number.isInteger(input.year) || input.year < 1300 || input.year > 1580) {
      errors.date = 'السنة الهجرية يجب أن تكون بين 1300 و 1580.';
    } else if (input.datePrecision !== 'year') {
      if (!input.month || input.month < 1 || input.month > 12) {
        errors.date = 'يرجى اختيار شهر هجري صحيح.';
      } else if (input.datePrecision === 'exact') {
        if (!input.day || input.day < 1 || input.day > 30) {
          errors.date = 'اليوم الهجري يجب أن يكون بين 1 و 30.';
        }
      }
    }
  }

  if (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) {
    errors.time = 'صيغة الوقت غير صحيحة (HH:MM).';
  }

  if (input.description.length > 5000) {
    errors.description = 'الوصف طويل جدًا (الحد الأقصى 5000 حرف).';
  }

  if (!input.categoryId) {
    errors.categoryId = 'يرجى اختيار تصنيف للحدث.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function buildTimelineEvent(
  input: EventFormInput,
  id: string,
  attachmentIds: string[],
  existing?: TimelineEvent,
  nowIso = new Date().toISOString(),
): TimelineEvent {
  let gregorianYear: number;
  let gregorianMonth: number | undefined;
  let gregorianDay: number | undefined;
  let hijriYear: number;
  let hijriMonth: number | undefined;
  let hijriDay: number | undefined;
  let hijriFormatted: string;

  if (input.calendarInput === 'gregorian') {
    gregorianYear = input.year;
    gregorianMonth = input.datePrecision !== 'year' ? input.month : undefined;
    gregorianDay = input.datePrecision === 'exact' ? input.day : undefined;
    const h = gregorianToHijri(input.datePrecision, gregorianYear, gregorianMonth, gregorianDay);
    hijriYear = h.hijriYear;
    hijriMonth = h.hijriMonth;
    hijriDay = h.hijriDay;
    hijriFormatted = h.formattedAr;
  } else {
    hijriYear = input.year;
    hijriMonth = input.datePrecision !== 'year' ? input.month : undefined;
    hijriDay = input.datePrecision === 'exact' ? input.day : undefined;
    const g = hijriToGregorian(input.datePrecision, hijriYear, hijriMonth, hijriDay);
    gregorianYear = g.year;
    gregorianMonth = g.month;
    gregorianDay = g.day;
    hijriFormatted = formatHijriParts(input.datePrecision, hijriYear, hijriMonth, hijriDay);
  }

  const sortDateKey = buildSortDateKey(gregorianYear, gregorianMonth, gregorianDay);

  const cleanedKeywords = Array.from(
    new Set(
      input.keywords
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    ),
  );

  return {
    id,
    title: input.title.trim(),
    datePrecision: input.datePrecision,
    calendarInput: input.calendarInput,
    gregorianYear,
    gregorianMonth,
    gregorianDay,
    sortDateKey,
    hijriYear,
    hijriMonth,
    hijriDay,
    hijriFormatted,
    time: input.time?.trim() ? input.time.trim() : undefined,
    categoryId: input.categoryId,
    description: input.description.trim(),
    location: input.location?.trim() ? input.location.trim() : undefined,
    keywords: cleanedKeywords,
    attachmentIds,
    isPinned: input.isPinned ? true : undefined,
    threadId: input.threadId?.trim() ? input.threadId.trim() : undefined,
    recurrence: input.recurrence,
    reminders: input.reminders && input.reminders.length > 0 ? input.reminders : undefined,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: nowIso,
  };
}

export function compareEventsDesc(a: TimelineEvent, b: TimelineEvent): number {
  if (a.sortDateKey !== b.sortDateKey) {
    return b.sortDateKey.localeCompare(a.sortDateKey);
  }
  const timeA = a.time ?? '00:00';
  const timeB = b.time ?? '00:00';
  if (timeA !== timeB) {
    return timeB.localeCompare(timeA);
  }
  return b.createdAt.localeCompare(a.createdAt);
}

export function filterEvents(
  events: TimelineEvent[],
  categoriesMap: Map<string, Category>,
  filters: TimelineFilters,
  today: DateParts,
  threadsMap?: Map<string, EventThread>,
): TimelineEvent[] {
  const query = normalizeArabic(filters.searchQuery);

  return events.filter((event) => {
    if (filters.temporal !== 'all') {
      const pos = classifyTemporalPosition(event, today);
      if (pos !== filters.temporal) return false;
    }

    if (filters.categoryId !== 'all' && event.categoryId !== filters.categoryId) {
      return false;
    }

    if (filters.year !== 'all' && event.gregorianYear !== filters.year) {
      return false;
    }

    if (query.length > 0) {
      const catName = categoriesMap.get(event.categoryId)?.name ?? '';
      const threadTitle = event.threadId ? (threadsMap?.get(event.threadId)?.title ?? '') : '';
      const gFormatted = formatEventGregorianDate(event);
      const haystack = normalizeArabic(
        [
          event.title,
          event.description,
          event.location ?? '',
          event.keywords.join(' '),
          catName,
          threadTitle,
          gFormatted,
          event.sortDateKey,
          event.hijriFormatted,
          String(event.gregorianYear),
          String(event.hijriYear),
        ].join(' '),
      );
      const tokens = query.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        if (!matchesArabicToken(haystack, token)) return false;
      }
    }

    return true;
  });
}

function groupIntoYearsAndMonths(events: TimelineEvent[]): YearGroup[] {
  const sorted = [...events].sort(compareEventsDesc);
  const yearMap = new Map<number, Map<number | null, TimelineEvent[]>>();

  for (const event of sorted) {
    if (!yearMap.has(event.gregorianYear)) {
      yearMap.set(event.gregorianYear, new Map());
    }
    const monthMap = yearMap.get(event.gregorianYear)!;
    const monthKey = event.datePrecision === 'year' ? null : (event.gregorianMonth ?? null);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, []);
    }
    monthMap.get(monthKey)!.push(event);
  }

  const years: YearGroup[] = [];
  for (const [year, monthMap] of yearMap.entries()) {
    const months: MonthGroup[] = [];
    let totalCount = 0;

    // Sort month keys descending: 12..1, then null (year-level approximate)
    const sortedMonthKeys = Array.from(monthMap.keys()).sort((a, b) => {
      if (a === null && b === null) return 0;
      if (a === null) return 1;
      if (b === null) return -1;
      return b - a;
    });

    for (const mKey of sortedMonthKeys) {
      const monthEvents = monthMap.get(mKey)!;
      totalCount += monthEvents.length;
      months.push({
        month: mKey,
        label:
          mKey === null
            ? 'أحداث بسنة تقريبية'
            : (GREGORIAN_MONTH_NAMES[mKey - 1] ?? `شهر ${mKey}`),
        events: monthEvents,
      });
    }

    years.push({ year, months, totalCount });
  }

  return years.sort((a, b) => b.year - a.year);
}

export function groupTimelineByHorizon(
  events: TimelineEvent[],
  today: DateParts,
): TimelineHorizonResult {
  const future: TimelineEvent[] = [];
  const todayEvents: TimelineEvent[] = [];
  const past: TimelineEvent[] = [];

  for (const event of events) {
    const pos = classifyTemporalPosition(event, today);
    if (pos === 'future') future.push(event);
    else if (pos === 'today') todayEvents.push(event);
    else past.push(event);
  }

  todayEvents.sort(compareEventsDesc);

  return {
    futureYears: groupIntoYearsAndMonths(future),
    todayEvents,
    pastYears: groupIntoYearsAndMonths(past),
  };
}

export function extractQuickYears(events: TimelineEvent[]): Array<{ year: number; count: number }> {
  const counts = new Map<number, number>();
  for (const ev of events) {
    counts.set(ev.gregorianYear, (counts.get(ev.gregorianYear) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);
}
