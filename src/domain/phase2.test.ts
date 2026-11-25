import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultCategories } from './defaults';
import { gregorianToHijri } from './hijri';
import {
  computeArchiveStatistics,
  computeDashboardSummary,
  computeReminderTriggerDateKey,
  getDueReminders,
  getNextOccurrence,
  getOnThisDayMemories,
} from './phase2';
import { buildTimelineEvent } from './timeline';
import type { DateParts, EventFormInput } from './types';

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

test('getNextOccurrence projects yearly Gregorian and Hijri recurring events accurately', () => {
  const gAnnual = makeEvent('g1', {
    title: 'ذكرى سنوية',
    year: 2020,
    month: 12,
    day: 1,
    recurrence: { frequency: 'yearly', calendar: 'gregorian' },
  });
  const nextG = getNextOccurrence(gAnnual, TODAY);
  assert.ok(nextG);
  assert.equal(nextG.occurrenceDateKey, '2026-12-01');
  assert.equal(nextG.daysRemaining, 8);
  assert.equal(nextG.isRecurringInstance, true);

  const pastThisYear = makeEvent('g2', {
    title: 'ذكرى فاتت هذا العام',
    year: 2020,
    month: 5,
    day: 10,
    recurrence: { frequency: 'yearly', calendar: 'gregorian' },
  });
  const nextG2 = getNextOccurrence(pastThisYear, TODAY);
  assert.ok(nextG2);
  assert.equal(nextG2.occurrenceDateKey, '2027-05-10');

  // Hijri annual recurrence (e.g. 1 Ramadan)
  const hAnnual = makeEvent('h1', {
    title: 'أول رمضان',
    calendarInput: 'hijri',
    year: 1445,
    month: 9,
    day: 1,
    recurrence: { frequency: 'yearly', calendar: 'hijri' },
  });
  const nextH = getNextOccurrence(hAnnual, TODAY);
  assert.ok(nextH);
  assert.ok(nextH.occurrenceDateKey >= '2026-11-23');
});

test('getOnThisDayMemories matches exact past Gregorian and Hijri memories', () => {
  const gMemory = makeEvent('m1', {
    title: 'ذكرى ميلادية',
    year: 2021,
    month: 11,
    day: 23,
  });
  const todayHijri = gregorianToHijri('exact', TODAY.year, TODAY.month, TODAY.day);
  const hMemory = makeEvent('m2', {
    title: 'ذكرى هجرية',
    calendarInput: 'hijri',
    year: todayHijri.hijriYear - 2,
    month: todayHijri.hijriMonth,
    day: todayHijri.hijriDay,
  });
  const approxIgnored = makeEvent('m3', {
    title: 'حدث تقريبي لا يطابق ذاكرة اليوم',
    datePrecision: 'month',
    year: 2021,
    month: 11,
  });

  const memories = getOnThisDayMemories([gMemory, hMemory, approxIgnored], TODAY);
  assert.equal(memories.length, 2);
  assert.equal(memories[0].yearsAgo, 2);
  assert.equal(memories[1].yearsAgo, 5);
});

test('computeReminderTriggerDateKey and getDueReminders identify due alerts cleanly', () => {
  assert.equal(computeReminderTriggerDateKey('2026-11-30', 'week_before'), '2026-11-23');
  assert.equal(computeReminderTriggerDateKey('2026-11-24', 'day_before'), '2026-11-23');
  assert.equal(computeReminderTriggerDateKey('2026-12-23', 'month_before'), '2026-11-23');

  const ev = makeEvent('r1', {
    title: 'موعد مهم',
    year: 2026,
    month: 11,
    day: 30,
    reminders: [{ id: 'rem1', offset: 'week_before' }],
  });
  const due = getDueReminders([ev], TODAY, new Set());
  assert.equal(due.length, 1);
  assert.equal(due[0].labelAr, 'قبل الموعد بأسبوع');

  const dismissed = getDueReminders([ev], TODAY, new Set([due[0].key]));
  assert.equal(dismissed.length, 0);
});

test('computeDashboardSummary and computeArchiveStatistics aggregate accurately', () => {
  const cats = createDefaultCategories();
  const events = [
    makeEvent('1', { year: 2026, month: 11, day: 25, isPinned: true, categoryId: 'cat-career' }),
    makeEvent('2', { year: 2026, month: 12, day: 18, categoryId: 'cat-career' }), // 25 days away (<= 30)
    makeEvent('4', { year: 2026, month: 12, day: 28, categoryId: 'cat-career' }), // 35 days away (> 30)
    makeEvent('3', { year: 2024, month: 11, day: 1, categoryId: 'cat-personal' }),
  ];
  const summary = computeDashboardSummary(events, TODAY);
  assert.equal(summary.totalCount, 4);
  assert.equal(summary.futureCount, 3);
  assert.equal(summary.pastCount, 1);
  assert.equal(summary.thisWeekCount, 1);
  assert.equal(summary.thisMonthCount, 2);
  assert.equal(summary.pinnedUpcoming.length, 1);
  assert.deepEqual(
    summary.nearestUpcoming.map((o) => o.event.id),
    ['1', '2'],
  );

  const stats = computeArchiveStatistics(events, cats);
  assert.equal(stats.mostActiveYear?.year, 2026);
  assert.equal(stats.mostActiveYear?.count, 3);
  assert.equal(stats.mostActiveMonth?.month, 11);
  assert.equal(stats.pinnedCount, 1);
});
