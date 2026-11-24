import { formatEventGregorianDate, normalizeArabic } from './timeline';
import type {
  Category,
  EventThread,
  TimelineEvent,
} from './types';

export const TIMELINE_BACKUP_VERSION = 1;

export interface SerializedAttachment {
  id: string;
  eventId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
  dataBase64: string;
}

export interface TimelineBackupPayload {
  app: 'Timeline';
  version: number;
  exportedAt: string;
  events: TimelineEvent[];
  categories: Category[];
  threads: EventThread[];
  attachments: SerializedAttachment[];
}

export interface BackupMergeResult {
  mergedEvents: TimelineEvent[];
  mergedCategories: Category[];
  mergedThreads: EventThread[];
  newAttachmentsToStore: SerializedAttachment[];
  addedEventsCount: number;
  skippedDuplicateEventsCount: number;
  addedCategoriesCount: number;
  addedThreadsCount: number;
  addedAttachmentsCount: number;
}

export function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function eventFingerprint(ev: TimelineEvent): string {
  return `${normalizeArabic(ev.title)}::${ev.sortDateKey}`;
}

export function isValidBackupPayload(raw: unknown): raw is TimelineBackupPayload {
  if (!raw || typeof raw !== 'object') return false;
  const obj = raw as Partial<TimelineBackupPayload>;
  return (
    obj.app === 'Timeline' &&
    Array.isArray(obj.events) &&
    Array.isArray(obj.categories) &&
    Array.isArray(obj.threads) &&
    Array.isArray(obj.attachments)
  );
}

/**
 * Merges an imported backup with the current local archive while preventing duplicates
 * by both record ID and normalized natural key (title+date for events, name for categories/threads).
 */
export function deduplicateBackupMerge(
  existingEvents: TimelineEvent[],
  existingCategories: Category[],
  existingThreads: EventThread[],
  existingAttachmentIds: Set<string>,
  incoming: TimelineBackupPayload,
): BackupMergeResult {
  const mergedCategories = [...existingCategories];
  const catById = new Map(existingCategories.map((c) => [c.id, c]));
  const catByName = new Map(existingCategories.map((c) => [normalizeArabic(c.name), c]));
  const catIdRemap = new Map<string, string>();
  let addedCategoriesCount = 0;

  for (const cat of incoming.categories) {
    if (!cat || typeof cat.id !== 'string' || typeof cat.name !== 'string') continue;
    const byId = catById.get(cat.id);
    if (byId) {
      catIdRemap.set(cat.id, byId.id);
      continue;
    }
    const byName = catByName.get(normalizeArabic(cat.name));
    if (byName) {
      catIdRemap.set(cat.id, byName.id);
      continue;
    }
    mergedCategories.push(cat);
    catById.set(cat.id, cat);
    catByName.set(normalizeArabic(cat.name), cat);
    catIdRemap.set(cat.id, cat.id);
    addedCategoriesCount++;
  }

  const fallbackCatId = mergedCategories[0]?.id ?? 'cat-personal';

  const mergedThreads = [...existingThreads];
  const threadById = new Map(existingThreads.map((t) => [t.id, t]));
  const threadByTitle = new Map(existingThreads.map((t) => [normalizeArabic(t.title), t]));
  const threadIdRemap = new Map<string, string>();
  let addedThreadsCount = 0;

  for (const th of incoming.threads) {
    if (!th || typeof th.id !== 'string' || typeof th.title !== 'string') continue;
    const byId = threadById.get(th.id);
    if (byId) {
      threadIdRemap.set(th.id, byId.id);
      continue;
    }
    const byTitle = threadByTitle.get(normalizeArabic(th.title));
    if (byTitle) {
      threadIdRemap.set(th.id, byTitle.id);
      continue;
    }
    mergedThreads.push(th);
    threadById.set(th.id, th);
    threadByTitle.set(normalizeArabic(th.title), th);
    threadIdRemap.set(th.id, th.id);
    addedThreadsCount++;
  }

  const mergedEvents = [...existingEvents];
  const seenEventIds = new Set(existingEvents.map((e) => e.id));
  const seenEventFingerprints = new Set(existingEvents.map(eventFingerprint));
  const acceptedEventIds = new Set<string>();
  let addedEventsCount = 0;
  let skippedDuplicateEventsCount = 0;

  for (const ev of incoming.events) {
    if (!ev || typeof ev.id !== 'string' || typeof ev.title !== 'string') continue;
    const fp = eventFingerprint(ev);
    if (seenEventIds.has(ev.id) || seenEventFingerprints.has(fp)) {
      skippedDuplicateEventsCount++;
      continue;
    }
    const normalizedEv: TimelineEvent = {
      ...ev,
      categoryId: catIdRemap.get(ev.categoryId) ?? (catById.has(ev.categoryId) ? ev.categoryId : fallbackCatId),
      threadId: ev.threadId ? (threadIdRemap.get(ev.threadId) ?? (threadById.has(ev.threadId) ? ev.threadId : undefined)) : undefined,
      attachmentIds: Array.isArray(ev.attachmentIds) ? ev.attachmentIds : [],
      keywords: Array.isArray(ev.keywords) ? ev.keywords : [],
    };
    mergedEvents.push(normalizedEv);
    seenEventIds.add(ev.id);
    seenEventFingerprints.add(fp);
    acceptedEventIds.add(ev.id);
    addedEventsCount++;
  }

  const newAttachmentsToStore: SerializedAttachment[] = [];
  const seenAttIds = new Set(existingAttachmentIds);
  for (const att of incoming.attachments) {
    if (!att || typeof att.id !== 'string' || typeof att.dataBase64 !== 'string') continue;
    if (seenAttIds.has(att.id)) continue;
    if (!acceptedEventIds.has(att.eventId)) continue;
    seenAttIds.add(att.id);
    newAttachmentsToStore.push(att);
  }

  return {
    mergedEvents,
    mergedCategories,
    mergedThreads,
    newAttachmentsToStore,
    addedEventsCount,
    skippedDuplicateEventsCount,
    addedCategoriesCount,
    addedThreadsCount,
    addedAttachmentsCount: newAttachmentsToStore.length,
  };
}

function escapeXml(value: string): string {
  // Guard against spreadsheet formula injection on leading = + - @
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return safe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates an Excel-compatible SpreadsheetML XML (.xls) file with RTL Arabic worksheet support.
 */
export function generateExcelSpreadsheetXml(
  events: TimelineEvent[],
  categoriesMap: Map<string, Category>,
  threadsMap: Map<string, EventThread>,
): string {
  const headers = [
    'العنوان',
    'التصنيف',
    'التاريخ الميلادي',
    'التاريخ الهجري',
    'الوقت',
    'الموقع',
    'السلسلة الموضوعية',
    'مثبت',
    'الكلمات المفتاحية',
    'الوصف والتفاصيل',
  ];

  const sorted = [...events].sort((a, b) => b.sortDateKey.localeCompare(a.sortDateKey));

  const renderCell = (text: string, styleId?: string) => {
    const styleAttr = styleId ? ` ss:StyleID="${styleId}"` : '';
    return `<Cell${styleAttr}><Data ss:Type="String">${escapeXml(text)}</Data></Cell>`;
  };

  const headerRow = `<Row>${headers.map((h) => renderCell(h, 'Header')).join('')}</Row>`;
  const bodyRows = sorted
    .map((ev) => {
      const cat = categoriesMap.get(ev.categoryId)?.name ?? 'عام';
      const th = ev.threadId ? (threadsMap.get(ev.threadId)?.title ?? '') : '';
      const cells = [
        renderCell(ev.title),
        renderCell(cat),
        renderCell(formatEventGregorianDate(ev)),
        renderCell(ev.hijriFormatted),
        renderCell(ev.time ?? ''),
        renderCell(ev.location ?? ''),
        renderCell(th),
        renderCell(ev.isPinned ? 'نعم' : 'لا'),
        renderCell(ev.keywords.join('، ')),
        renderCell(ev.description),
      ].join('');
      return `<Row>${cells}</Row>`;
    })
    .join('\n      ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Header">
      <Font ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#8C3B2B" ss:Pattern="Solid"/>
    </Style>
  </Styles>
  <Worksheet ss:Name="الأرشيف الزمني" ss:RightToLeft="1">
    <Table>
      ${headerRow}
      ${bodyRows}
    </Table>
  </Worksheet>
</Workbook>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generatePrintableArchiveHtml(
  events: TimelineEvent[],
  categoriesMap: Map<string, Category>,
  threadsMap: Map<string, EventThread>,
  exportedAtLabel: string,
): string {
  const sorted = [...events].sort((a, b) => b.sortDateKey.localeCompare(a.sortDateKey));
  const rowsHtml = sorted
    .map((ev) => {
      const cat = categoriesMap.get(ev.categoryId)?.name ?? 'عام';
      const thread = ev.threadId ? threadsMap.get(ev.threadId)?.title : '';
      return `<article class="card">
        <div class="meta">${escapeHtml(cat)} · ${escapeHtml(formatEventGregorianDate(ev))} · ${escapeHtml(ev.hijriFormatted)}${ev.time ? ` · ${escapeHtml(ev.time)}` : ''}${thread ? ` · ${escapeHtml(thread)}` : ''}</div>
        <h2>${escapeHtml(ev.title)}</h2>
        ${ev.location ? `<div class="loc">الموقع: ${escapeHtml(ev.location)}</div>` : ''}
        ${ev.description ? `<p>${escapeHtml(ev.description)}</p>` : ''}
        ${ev.keywords.length > 0 ? `<div class="kw">${escapeHtml(ev.keywords.join(' · '))}</div>` : ''}
      </article>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>Timeline — تقرير الأرشيف الشخصي</title>
  <style>
    body { font-family: "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif; color: #1C1917; margin: 28px; line-height: 1.6; }
    header { border-bottom: 2px solid #8C3B2B; padding-bottom: 12px; margin-bottom: 20px; }
    h1 { margin: 0 0 4px 0; font-size: 22px; color: #1C1917; }
    .sub { font-size: 12px; color: #57534E; }
    .card { border: 1px solid #E7E5E4; border-radius: 10px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .meta { font-size: 11px; color: #8C3B2B; font-weight: 600; margin-bottom: 4px; }
    h2 { margin: 0 0 6px 0; font-size: 16px; }
    .loc, .kw { font-size: 11px; color: #57534E; margin-top: 4px; }
    p { margin: 4px 0 0 0; font-size: 13px; white-space: pre-line; }
  </style>
</head>
<body>
  <header>
    <h1>Timeline — سجل الأرشيف الشخصي</h1>
    <div class="sub">تاريخ التصدير: ${escapeHtml(exportedAtLabel)} · إجمالي الأحداث: ${sorted.length}</div>
  </header>
  ${rowsHtml || '<p>لا توجد أحداث مسجلة.</p>'}
</body>
</html>`;
}
