import assert from 'node:assert/strict';
import test from 'node:test';
import {
  base64ToBytes,
  bytesToBase64,
  deduplicateBackupMerge,
  generateExcelSpreadsheetXml,
  generatePrintableArchiveHtml,
  type TimelineBackupPayload,
} from './backup.ts';
import { createDefaultCategories } from './defaults.ts';
import { buildTimelineEvent } from './timeline.ts';

test('bytesToBase64 and base64ToBytes round-trip binary bytes accurately', () => {
  const sample = new Uint8Array([0, 12, 65, 128, 255, 42]);
  const b64 = bytesToBase64(sample);
  const restored = base64ToBytes(b64);
  assert.deepEqual(Array.from(restored), Array.from(sample));
});

test('deduplicateBackupMerge prevents duplicates by id and title+date while merging new items', () => {
  const categories = createDefaultCategories();
  const existingEv = buildTimelineEvent(
    {
      title: 'تخرّج الجامعة',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: 2022,
      month: 6,
      day: 15,
      categoryId: 'cat-work',
      description: 'حفل التخرج',
      keywords: ['تخرج'],
    },
    'ev-1',
    [],
  );

  const dupByDifferentId = buildTimelineEvent(
    {
      title: 'تخرج الجامعه', // normalized duplicate of existing title on same sortDateKey
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: 2022,
      month: 6,
      day: 15,
      categoryId: 'cat-work',
      description: 'نسخة مكررة',
      keywords: [],
    },
    'ev-dup',
    ['att-dup'],
  );

  const brandNewEv = buildTimelineEvent(
    {
      title: 'رحلة العمرة',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: 2025,
      month: 3,
      day: 10,
      categoryId: 'cat-new',
      description: 'زيارة مكة',
      keywords: ['عمرة'],
    },
    'ev-2',
    ['att-new'],
  );

  const incoming: TimelineBackupPayload = {
    app: 'Timeline',
    version: 1,
    exportedAt: '2026-11-24T00:00:00Z',
    categories: [
      { id: 'cat-new', name: 'روحانيات', colorKey: 'plum', isDefault: false, order: 7, createdAt: '2026-01-01' },
    ],
    threads: [],
    events: [dupByDifferentId, brandNewEv],
    attachments: [
      {
        id: 'att-dup',
        eventId: 'ev-dup',
        name: 'dup.png',
        mimeType: 'image/png',
        size: 3,
        createdAt: '2026-01-01',
        dataBase64: bytesToBase64(new Uint8Array([1, 2, 3])),
      },
      {
        id: 'att-new',
        eventId: 'ev-2',
        name: 'makkah.png',
        mimeType: 'image/png',
        size: 3,
        createdAt: '2026-01-01',
        dataBase64: bytesToBase64(new Uint8Array([4, 5, 6])),
      },
    ],
  };

  const res = deduplicateBackupMerge([existingEv], categories, [], new Set(), incoming);
  assert.equal(res.addedEventsCount, 1);
  assert.equal(res.skippedDuplicateEventsCount, 1);
  assert.equal(res.addedCategoriesCount, 1);
  assert.equal(res.addedAttachmentsCount, 1);
  assert.equal(res.newAttachmentsToStore[0].id, 'att-new');
});

test('generateExcelSpreadsheetXml and generatePrintableArchiveHtml escape unsafe characters and formulas', () => {
  const categories = createDefaultCategories();
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const ev = buildTimelineEvent(
    {
      title: '=SUM(A1:A2) <script>alert(1)</script>',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: 2026,
      month: 5,
      day: 1,
      categoryId: 'cat-personal',
      description: 'اختبار & أمان',
      keywords: [],
    },
    'ev-sec',
    [],
  );

  const xml = generateExcelSpreadsheetXml([ev], catMap, new Map());
  assert.ok(xml.includes('ss:RightToLeft="1"'));
  assert.ok(xml.includes("&apos;=SUM"));
  assert.ok(!xml.includes('<script>'));

  const html = generatePrintableArchiveHtml([ev], catMap, new Map(), '2026-11-24');
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});
