import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCategories } from './defaults';
import {
  buildTimelineEvent,
  classifyTemporalPosition,
  filterEvents,
  getRelativeTimeLabel,
  groupTimelineByHorizon,
  normalizeArabic,
  validateEventInput,
} from './timeline';
import type { Category, DateParts, EventFormInput } from './types';

const TODAY: DateParts = { year: 2026, month: 11, day: 23 };

function makeEvent(id: string, overrides: Partial<EventFormInput>) {
  const input: EventFormInput = {
    title: 'حدث تجريبي',
    datePrecision: 'exact',
    calendarInput: 'gregorian',
    year: 2026,
    month: 11,
    day: 23,
    categoryId: 'cat-personal',
    description: '',
    keywords: [],
    ...overrides,
  };
  return buildTimelineEvent(input, id, [], undefined, '2026-11-23T12:00:00.000Z');
}

test('normalizeArabic strips diacritics and normalizes hamza/taa marbuta/alef maksura/digits/tatweel', () => {
  assert.equal(normalizeArabic('أَحْمَدُ فِي المَدْرَسَةِ الكبرى'), 'احمد في المدرسه الكبري');
  assert.equal(normalizeArabic('إنجاز مالي'), 'انجاز مالي');
  assert.equal(normalizeArabic('آمالُ ٱلأُمَّةِ'), 'امال الامه');
  assert.equal(normalizeArabic('شئ وشيء وعائلة وعايله'), 'شي وشي وعايله وعايله');
  assert.equal(normalizeArabic('مؤتمر ومسؤول وقراءة وقراه'), 'موتمر ومسوول وقراه وقراه');
  assert.equal(normalizeArabic('تَخَـــرُّج ٢٠٢٦'), 'تخرج 2026');
});

test('classifyTemporalPosition handles exact, month, and year precisions', () => {
  assert.equal(
    classifyTemporalPosition(
      { datePrecision: 'exact', gregorianYear: 2026, gregorianMonth: 11, gregorianDay: 22 },
      TODAY,
    ),
    'past',
  );
  assert.equal(
    classifyTemporalPosition(
      { datePrecision: 'exact', gregorianYear: 2026, gregorianMonth: 11, gregorianDay: 23 },
      TODAY,
    ),
    'today',
  );
  assert.equal(
    classifyTemporalPosition(
      { datePrecision: 'exact', gregorianYear: 2026, gregorianMonth: 11, gregorianDay: 24 },
      TODAY,
    ),
    'future',
  );

  // Month precision in same month -> today; earlier month -> past
  assert.equal(
    classifyTemporalPosition(
      { datePrecision: 'month', gregorianYear: 2026, gregorianMonth: 11 },
      TODAY,
    ),
    'today',
  );
  assert.equal(
    classifyTemporalPosition(
      { datePrecision: 'month', gregorianYear: 2026, gregorianMonth: 10 },
      TODAY,
    ),
    'past',
  );

  // Year precision in current year -> today; next year -> future
  assert.equal(
    classifyTemporalPosition({ datePrecision: 'year', gregorianYear: 2026 }, TODAY),
    'today',
  );
  assert.equal(
    classifyTemporalPosition({ datePrecision: 'year', gregorianYear: 2027 }, TODAY),
    'future',
  );
});

test('groupTimelineByHorizon splits future above, today at center, past below in descending order', () => {
  const eFutureFar = makeEvent('f2', { title: 'مستقبل بعيد', year: 2028, month: 1, day: 10 });
  const eFutureNear = makeEvent('f1', { title: 'مستقبل قريب', year: 2026, month: 12, day: 5 });
  const eToday = makeEvent('t1', { title: 'اليوم', year: 2026, month: 11, day: 23 });
  const ePastRecent = makeEvent('p1', { title: 'أمس', year: 2026, month: 11, day: 22 });
  const ePastOld = makeEvent('p2', { title: 'ماض قديم', datePrecision: 'year', year: 2020 });

  const grouped = groupTimelineByHorizon(
    [ePastOld, eFutureNear, eToday, eFutureFar, ePastRecent],
    TODAY,
  );

  assert.deepEqual(
    grouped.futureYears.map((y) => y.year),
    [2028, 2026],
  );
  assert.deepEqual(
    grouped.todayEvents.map((e) => e.id),
    ['t1'],
  );
  assert.deepEqual(
    grouped.pastYears.map((y) => y.year),
    [2026, 2020],
  );
});

test('filterEvents searches across title, description, location, keywords, category, and Hijri/Gregorian dates', () => {
  const cats = createDefaultCategories();
  const catMap = new Map<string, Category>(cats.map((c) => [c.id, c]));

  const e1 = makeEvent('1', {
    title: 'تخرّج الجامعة',
    description: 'حفل التخرج مع الأهل',
    location: 'الرياض',
    keywords: ['شهادة', 'تفوق'],
    categoryId: 'cat-career',
    year: 2022,
    month: 5,
    day: 14,
  });
  const e2 = makeEvent('2', {
    title: 'رحلة جدة',
    categoryId: 'cat-travel',
    year: 2027,
    month: 2,
    day: 1,
  });

  // Normalized Arabic search without hamza/diacritics
  assert.equal(
    filterEvents([e1, e2], catMap, { temporal: 'all', categoryId: 'all', year: 'all', searchQuery: 'تخرج الاهل' }, TODAY)
      .length,
    1,
  );
  // Search by location
  assert.equal(
    filterEvents([e1, e2], catMap, { temporal: 'all', categoryId: 'all', year: 'all', searchQuery: 'الرياض' }, TODAY)
      .length,
    1,
  );
  // Search by category name
  assert.equal(
    filterEvents([e1, e2], catMap, { temporal: 'all', categoryId: 'all', year: 'all', searchQuery: 'سفر' }, TODAY)
      .length,
    1,
  );
  // Search by year (both ASCII and Arabic-Indic numerals)
  assert.equal(
    filterEvents([e1, e2], catMap, { temporal: 'all', categoryId: 'all', year: 'all', searchQuery: '2022' }, TODAY)
      .length,
    1,
  );
  assert.equal(
    filterEvents([e1, e2], catMap, { temporal: 'all', categoryId: 'all', year: 'all', searchQuery: '٢٠٢٢' }, TODAY)
      .length,
    1,
  );

  // Search ignoring أ/إ/ا, ه/ة, ي/ى, ئ/ي, and ال prefix variations
  const e3 = makeEvent('3', {
    title: 'قراءة عائلة أحمد الكبرى',
    description: 'زيارة مستشفى جدة',
    year: 2025,
    month: 3,
    day: 10,
  });
  assert.equal(
    filterEvents([e3], catMap, { temporal: 'all', categoryId: 'all', year: 'all', searchQuery: 'قراه عايله احمد الكبري' }, TODAY)
      .length,
    1,
  );
  assert.equal(
    filterEvents([e3], catMap, { temporal: 'all', categoryId: 'all', year: 'all', searchQuery: 'المستشفي جده' }, TODAY)
      .length,
    1,
  );
});

test('validateEventInput catches empty title and invalid leap-day dates', () => {
  const emptyTitle = validateEventInput({
    title: '   ',
    datePrecision: 'exact',
    calendarInput: 'gregorian',
    year: 2025,
    month: 3,
    day: 10,
    categoryId: 'cat-personal',
    description: '',
    keywords: [],
  });
  assert.equal(emptyTitle.valid, false);
  assert.ok(emptyTitle.errors.title);

  const badLeapDay = validateEventInput({
    title: 'اختبار',
    datePrecision: 'exact',
    calendarInput: 'gregorian',
    year: 2025, // not a leap year
    month: 2,
    day: 29,
    categoryId: 'cat-personal',
    description: '',
    keywords: [],
  });
  assert.equal(badLeapDay.valid, false);
  assert.ok(badLeapDay.errors.date);
});

test('getRelativeTimeLabel returns accurate Arabic labels', () => {
  assert.equal(
    getRelativeTimeLabel({ datePrecision: 'exact', gregorianYear: 2026, gregorianMonth: 11, gregorianDay: 24 }, TODAY),
    'غدًا',
  );
  assert.equal(
    getRelativeTimeLabel({ datePrecision: 'exact', gregorianYear: 2026, gregorianMonth: 11, gregorianDay: 22 }, TODAY),
    'أمس',
  );
  assert.equal(
    getRelativeTimeLabel({ datePrecision: 'exact', gregorianYear: 2026, gregorianMonth: 11, gregorianDay: 23 }, TODAY),
    'اليوم',
  );
});
