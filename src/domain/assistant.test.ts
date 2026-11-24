import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMemoryContextForAI, searchEventsSemanticOffline } from './assistant.ts';
import { createDefaultCategories } from './defaults.ts';
import { buildTimelineEvent } from './timeline.ts';

test('searchEventsSemanticOffline matches conceptual Arabic synonyms across archive events', () => {
  const categories = createDefaultCategories();
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const travelEv = buildTimelineEvent(
    {
      title: 'تجديد جواز السفر',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: 2026,
      month: 11,
      day: 29,
      categoryId: 'cat-travel',
      description: 'حجز رحلة الصيف والطيران',
      keywords: ['جواز'],
    },
    'ev-travel',
    [],
  );

  const workEv = buildTimelineEvent(
    {
      title: 'مراجعة الخطة المهنية',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: 2026,
      month: 12,
      day: 16,
      categoryId: 'cat-work',
      description: 'أهداف العمل',
      keywords: [],
    },
    'ev-work',
    [],
  );

  const hits = searchEventsSemanticOffline([travelEv, workEv], catMap, new Map(), 'تاشيره مطار');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].event.id, 'ev-travel');

  const hitsWithAl = searchEventsSemanticOffline([travelEv, workEv], catMap, new Map(), 'السفر تأشيرة');
  assert.equal(hitsWithAl.length, 1);
  assert.equal(hitsWithAl[0].event.id, 'ev-travel');

  const ctx = buildMemoryContextForAI([travelEv, workEv], catMap, new Map());
  assert.equal(ctx.length, 2);
  assert.equal(ctx[0].id, 'ev-work'); // sorted desc by sortDateKey
});
