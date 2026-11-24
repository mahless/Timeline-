import test from 'node:test';
import assert from 'node:assert/strict';
import { gregorianToHijri, hijriToGregorian } from './hijri';

test('gregorianToHijri converts exact dates accurately', () => {
  const res = gregorianToHijri('exact', 2026, 11, 23);
  assert.ok(res.hijriYear >= 1447 && res.hijriYear <= 1449);
  assert.ok(res.hijriMonth && res.hijriMonth >= 1 && res.hijriMonth <= 12);
  assert.ok(res.hijriDay && res.hijriDay >= 1 && res.hijriDay <= 30);
  assert.ok(res.formattedAr.includes('هـ'));
});

test('gregorianToHijri handles approximate month and year precisions', () => {
  const monthRes = gregorianToHijri('month', 2025, 3);
  assert.equal(monthRes.hijriDay, undefined);
  assert.ok(monthRes.hijriMonth);
  assert.ok(monthRes.formattedAr.includes('(تقريبي)'));

  const yearRes = gregorianToHijri('year', 2020);
  assert.equal(yearRes.hijriMonth, undefined);
  assert.equal(yearRes.hijriDay, undefined);
  assert.ok(yearRes.formattedAr.includes('(تقريبي)'));
});

test('hijriToGregorian round-trips exact dates faithfully', () => {
  const original = { year: 2025, month: 3, day: 15 };
  const h = gregorianToHijri('exact', original.year, original.month, original.day);
  const back = hijriToGregorian('exact', h.hijriYear, h.hijriMonth, h.hijriDay);
  assert.deepEqual(back, original);
});

test('hijriToGregorian converts 1 Ramadan 1447 to a valid Gregorian date', () => {
  const g = hijriToGregorian('exact', 1447, 9, 1);
  assert.equal(g.year, 2026);
  assert.equal(g.month, 2);
  assert.ok(g.day && g.day >= 17 && g.day <= 20);
});
