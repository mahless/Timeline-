import type { DatePrecision } from './types';

export const GREGORIAN_MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

export const HIJRI_MONTH_NAMES = [
  'محرم',
  'صفر',
  'ربيع الأول',
  'ربيع الآخر',
  'جمادى الأولى',
  'جمادى الآخرة',
  'رجب',
  'شعبان',
  'رمضان',
  'شوال',
  'ذو القعدة',
  'ذو الحجة',
];

export interface HijriConversionResult {
  hijriYear: number;
  hijriMonth?: number;
  hijriDay?: number;
  formattedAr: string;
  searchTokens: string;
}

const hijriFormatter = (() => {
  try {
    return new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch {
    return new Intl.DateTimeFormat('en-u-ca-islamic', {
      timeZone: 'UTC',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  }
})();

export function extractHijriPartsUTC(utcDate: Date): { year: number; month: number; day: number } {
  const parts = hijriFormatter.formatToParts(utcDate);
  let year = 1448;
  let month = 1;
  let day = 1;
  for (const part of parts) {
    if (part.type === 'year') {
      const parsed = parseInt(part.value.replace(/[^\d]/g, ''), 10);
      if (!Number.isNaN(parsed)) year = parsed;
    } else if (part.type === 'month') {
      const parsed = parseInt(part.value, 10);
      if (!Number.isNaN(parsed)) month = parsed;
    } else if (part.type === 'day') {
      const parsed = parseInt(part.value, 10);
      if (!Number.isNaN(parsed)) day = parsed;
    }
  }
  return { year, month, day };
}

export function formatHijriParts(
  precision: DatePrecision,
  hYear: number,
  hMonth?: number,
  hDay?: number,
): string {
  if (precision === 'year') {
    return `${hYear} هـ (تقريبي)`;
  }
  if (precision === 'month' && hMonth) {
    const monthName = HIJRI_MONTH_NAMES[hMonth - 1] ?? `شهر ${hMonth}`;
    return `${monthName} ${hYear} هـ (تقريبي)`;
  }
  if (hMonth && hDay) {
    const monthName = HIJRI_MONTH_NAMES[hMonth - 1] ?? `شهر ${hMonth}`;
    return `${hDay} ${monthName} ${hYear} هـ`;
  }
  return `${hYear} هـ`;
}

export function gregorianToHijri(
  precision: DatePrecision,
  gYear: number,
  gMonth?: number,
  gDay?: number,
): HijriConversionResult {
  const safeMonth = gMonth ?? 7; // mid-year anchor for year-only approximate date
  const safeDay = gDay ?? 15; // mid-month anchor for month-only approximate date
  const utc = new Date(Date.UTC(gYear, safeMonth - 1, safeDay));
  const parts = extractHijriPartsUTC(utc);

  if (precision === 'year') {
    const formattedAr = formatHijriParts('year', parts.year);
    return {
      hijriYear: parts.year,
      formattedAr,
      searchTokens: `${parts.year} هـ`,
    };
  }

  if (precision === 'month') {
    const formattedAr = formatHijriParts('month', parts.year, parts.month);
    const monthName = HIJRI_MONTH_NAMES[parts.month - 1] ?? '';
    return {
      hijriYear: parts.year,
      hijriMonth: parts.month,
      formattedAr,
      searchTokens: `${parts.year} ${monthName} هـ`,
    };
  }

  const formattedAr = formatHijriParts('exact', parts.year, parts.month, parts.day);
  const monthName = HIJRI_MONTH_NAMES[parts.month - 1] ?? '';
  return {
    hijriYear: parts.year,
    hijriMonth: parts.month,
    hijriDay: parts.day,
    formattedAr,
    searchTokens: `${parts.day} ${monthName} ${parts.year} هـ`,
  };
}

function compareHijriTuples(
  a: { year: number; month: number; day: number },
  b: { year: number; month: number; day: number },
): number {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

/**
 * Converts a Hijri date (exact, month-only, or year-only) to its corresponding Gregorian date
 * using binary search over UTC days against Intl Islamic Umm al-Qura calendar.
 */
export function hijriToGregorian(
  precision: DatePrecision,
  hYear: number,
  hMonth?: number,
  hDay?: number,
): { year: number; month?: number; day?: number } {
  const target = {
    year: hYear,
    month: precision === 'year' ? 7 : (hMonth ?? 1),
    day: precision === 'exact' ? (hDay ?? 1) : 15,
  };

  const approxGYear = Math.floor(hYear * 0.970224 + 621.57);
  let low = Date.UTC(approxGYear - 2, 0, 1);
  let high = Date.UTC(approxGYear + 2, 11, 31);

  const dayMs = 86_400_000;
  let lowDay = Math.floor(low / dayMs);
  let highDay = Math.floor(high / dayMs);
  let bestDay = Math.floor((lowDay + highDay) / 2);

  while (lowDay <= highDay) {
    const mid = Math.floor((lowDay + highDay) / 2);
    const utc = new Date(mid * dayMs);
    const current = extractHijriPartsUTC(utc);
    const cmp = compareHijriTuples(current, target);
    if (cmp === 0) {
      bestDay = mid;
      break;
    }
    if (cmp < 0) {
      lowDay = mid + 1;
      bestDay = mid;
    } else {
      highDay = mid - 1;
    }
  }

  const matched = new Date(bestDay * dayMs);
  const year = matched.getUTCFullYear();
  const month = matched.getUTCMonth() + 1;
  const day = matched.getUTCDate();

  if (precision === 'year') {
    return { year };
  }
  if (precision === 'month') {
    return { year, month };
  }
  return { year, month, day };
}

export function getGregorianDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
