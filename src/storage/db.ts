import {
  base64ToBytes,
  bytesToBase64,
  deduplicateBackupMerge,
  TIMELINE_BACKUP_VERSION,
  type BackupMergeResult,
  type SerializedAttachment,
  type TimelineBackupPayload,
} from '../domain/backup';
import {
  createDefaultCategories,
  createSampleEventInputs,
  createSampleThreads,
} from '../domain/defaults';
import { buildTimelineEvent, getTodayParts } from '../domain/timeline';
import type {
  AttachmentRecord,
  Category,
  EventThread,
  TimelineEvent,
} from '../domain/types';

const DB_NAME = 'timeline_archive_db';
const DB_VERSION = 2;

const STORE_EVENTS = 'events';
const STORE_CATEGORIES = 'categories';
const STORE_ATTACHMENTS = 'attachments';
const STORE_THREADS = 'threads';
const STORE_META = 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('المتصفح الحالي لا يدعم IndexedDB للتخزين المحلي.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE_EVENTS)) {
        const eventsStore = db.createObjectStore(STORE_EVENTS, { keyPath: 'id' });
        eventsStore.createIndex('by_sortDateKey', 'sortDateKey', { unique: false });
        eventsStore.createIndex('by_categoryId', 'categoryId', { unique: false });
        eventsStore.createIndex('by_year', 'gregorianYear', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CATEGORIES)) {
        const catStore = db.createObjectStore(STORE_CATEGORIES, { keyPath: 'id' });
        catStore.createIndex('by_order', 'order', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_ATTACHMENTS)) {
        const attStore = db.createObjectStore(STORE_ATTACHMENTS, { keyPath: 'id' });
        attStore.createIndex('by_eventId', 'eventId', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_THREADS)) {
        const threadStore = db.createObjectStore(STORE_THREADS, { keyPath: 'id' });
        threadStore.createIndex('by_createdAt', 'createdAt', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error ?? new Error('تعذر فتح قاعدة البيانات المحلية.'));
    };
  });

  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('فشلت عملية قاعدة البيانات المحلية.'));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('فشلت معاملة الحفظ في قاعدة البيانات.'));
    tx.onabort = () => reject(tx.error ?? new Error('تم إلغاء عملية الحفظ.'));
  });
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function initializeArchive(): Promise<{
  events: TimelineEvent[];
  categories: Category[];
  threads: EventThread[];
}> {
  const db = await openDatabase();

  const readTx = db.transaction(
    [STORE_CATEGORIES, STORE_EVENTS, STORE_THREADS, STORE_META],
    'readonly',
  );
  const existingCats = await reqToPromise<Category[]>(readTx.objectStore(STORE_CATEGORIES).getAll());
  const existingEvents = await reqToPromise<TimelineEvent[]>(readTx.objectStore(STORE_EVENTS).getAll());
  const existingThreads = await reqToPromise<EventThread[]>(readTx.objectStore(STORE_THREADS).getAll());
  const seededMeta = await reqToPromise<{ key: string; value: unknown } | undefined>(
    readTx.objectStore(STORE_META).get('categoriesSeeded'),
  );
  await txDone(readTx);

  let categories = existingCats;
  if (categories.length === 0 && !seededMeta) {
    const defaults = createDefaultCategories();
    const writeTx = db.transaction([STORE_CATEGORIES, STORE_META], 'readwrite');
    const catStore = writeTx.objectStore(STORE_CATEGORIES);
    for (const cat of defaults) {
      catStore.put(cat);
    }
    writeTx.objectStore(STORE_META).put({ key: 'categoriesSeeded', value: true });
    await txDone(writeTx);
    categories = defaults;
  }

  categories.sort((a, b) => a.order - b.order);
  existingThreads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    events: existingEvents,
    categories,
    threads: existingThreads,
  };
}

export async function saveEventWithAttachments(
  event: TimelineEvent,
  newAttachments: AttachmentRecord[],
  removedAttachmentIds: string[],
): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_ATTACHMENTS], 'readwrite');
  tx.objectStore(STORE_EVENTS).put(event);

  const attStore = tx.objectStore(STORE_ATTACHMENTS);
  for (const att of newAttachments) {
    attStore.put(att);
  }
  for (const removeId of removedAttachmentIds) {
    attStore.delete(removeId);
  }

  await txDone(tx);
}

export async function deleteEventAndAttachments(eventId: string): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_EVENTS, STORE_ATTACHMENTS], 'readwrite');
  tx.objectStore(STORE_EVENTS).delete(eventId);

  const attStore = tx.objectStore(STORE_ATTACHMENTS);
  const idx = attStore.index('by_eventId');
  const keys = await reqToPromise<IDBValidKey[]>(idx.getAllKeys(eventId));
  for (const key of keys) {
    attStore.delete(key);
  }

  await txDone(tx);
}

export async function getAttachmentsForEvent(eventId: string): Promise<AttachmentRecord[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
  const idx = tx.objectStore(STORE_ATTACHMENTS).index('by_eventId');
  const records = await reqToPromise<AttachmentRecord[]>(idx.getAll(eventId));
  await txDone(tx);
  return records;
}

export async function saveCategory(category: Category): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_CATEGORIES, 'readwrite');
  tx.objectStore(STORE_CATEGORIES).put(category);
  await txDone(tx);
}

export async function deleteCategoryAndReassign(
  categoryId: string,
  fallbackCategoryId: string,
): Promise<TimelineEvent[]> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_CATEGORIES, STORE_EVENTS], 'readwrite');

  const eventsStore = tx.objectStore(STORE_EVENTS);
  const matching = await reqToPromise<TimelineEvent[]>(
    eventsStore.index('by_categoryId').getAll(categoryId),
  );
  const updated: TimelineEvent[] = [];
  for (const ev of matching) {
    const next = { ...ev, categoryId: fallbackCategoryId, updatedAt: new Date().toISOString() };
    eventsStore.put(next);
    updated.push(next);
  }

  tx.objectStore(STORE_CATEGORIES).delete(categoryId);
  await txDone(tx);
  return updated;
}

export async function saveThread(thread: EventThread): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_THREADS, 'readwrite');
  tx.objectStore(STORE_THREADS).put(thread);
  await txDone(tx);
}

export async function deleteThreadAndUnlink(threadId: string): Promise<TimelineEvent[]> {
  const db = await openDatabase();
  const tx = db.transaction([STORE_THREADS, STORE_EVENTS], 'readwrite');

  const eventsStore = tx.objectStore(STORE_EVENTS);
  const allEvents = await reqToPromise<TimelineEvent[]>(eventsStore.getAll());
  const updated: TimelineEvent[] = [];
  for (const ev of allEvents) {
    if (ev.threadId === threadId) {
      const next = { ...ev, threadId: undefined, updatedAt: new Date().toISOString() };
      eventsStore.put(next);
      updated.push(next);
    }
  }

  tx.objectStore(STORE_THREADS).delete(threadId);
  await txDone(tx);
  return updated;
}

export async function seedSampleArchive(): Promise<{
  events: TimelineEvent[];
  threads: EventThread[];
}> {
  const db = await openDatabase();
  const today = getTodayParts();
  const sampleThreads = createSampleThreads();
  const inputs = createSampleEventInputs(today);
  const events = inputs.map((input) => buildTimelineEvent(input, generateId(), []));

  const tx = db.transaction([STORE_EVENTS, STORE_THREADS], 'readwrite');
  const eventStore = tx.objectStore(STORE_EVENTS);
  for (const ev of events) {
    eventStore.put(ev);
  }
  const threadStore = tx.objectStore(STORE_THREADS);
  for (const th of sampleThreads) {
    threadStore.put(th);
  }
  await txDone(tx);
  return { events, threads: sampleThreads };
}

export async function getAllAttachments(): Promise<AttachmentRecord[]> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_ATTACHMENTS, 'readonly');
  const records = await reqToPromise<AttachmentRecord[]>(tx.objectStore(STORE_ATTACHMENTS).getAll());
  await txDone(tx);
  records.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return records;
}

export async function exportFullBackup(): Promise<TimelineBackupPayload> {
  const db = await openDatabase();
  const tx = db.transaction(
    [STORE_EVENTS, STORE_CATEGORIES, STORE_THREADS, STORE_ATTACHMENTS],
    'readonly',
  );
  const events = await reqToPromise<TimelineEvent[]>(tx.objectStore(STORE_EVENTS).getAll());
  const categories = await reqToPromise<Category[]>(tx.objectStore(STORE_CATEGORIES).getAll());
  const threads = await reqToPromise<EventThread[]>(tx.objectStore(STORE_THREADS).getAll());
  const attachments = await reqToPromise<AttachmentRecord[]>(tx.objectStore(STORE_ATTACHMENTS).getAll());
  await txDone(tx);

  const serializedAttachments: SerializedAttachment[] = await Promise.all(
    attachments.map(async (att) => {
      const buf = await att.blob.arrayBuffer();
      return {
        id: att.id,
        eventId: att.eventId,
        name: att.name,
        mimeType: att.mimeType,
        size: att.size,
        createdAt: att.createdAt,
        dataBase64: bytesToBase64(new Uint8Array(buf)),
      };
    }),
  );

  return {
    app: 'Timeline',
    version: TIMELINE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    events,
    categories,
    threads,
    attachments: serializedAttachments,
  };
}

export async function importFullBackup(
  incoming: TimelineBackupPayload,
): Promise<BackupMergeResult & {
  events: TimelineEvent[];
  categories: Category[];
  threads: EventThread[];
}> {
  const db = await openDatabase();
  const readTx = db.transaction(
    [STORE_EVENTS, STORE_CATEGORIES, STORE_THREADS, STORE_ATTACHMENTS],
    'readonly',
  );
  const existingEvents = await reqToPromise<TimelineEvent[]>(readTx.objectStore(STORE_EVENTS).getAll());
  const existingCategories = await reqToPromise<Category[]>(readTx.objectStore(STORE_CATEGORIES).getAll());
  const existingThreads = await reqToPromise<EventThread[]>(readTx.objectStore(STORE_THREADS).getAll());
  const existingAttIds = await reqToPromise<IDBValidKey[]>(
    readTx.objectStore(STORE_ATTACHMENTS).getAllKeys(),
  );
  await txDone(readTx);

  const mergeResult = deduplicateBackupMerge(
    existingEvents,
    existingCategories,
    existingThreads,
    new Set(existingAttIds.map(String)),
    incoming,
  );

  const writeTx = db.transaction(
    [STORE_EVENTS, STORE_CATEGORIES, STORE_THREADS, STORE_ATTACHMENTS],
    'readwrite',
  );
  const catStore = writeTx.objectStore(STORE_CATEGORIES);
  for (const cat of mergeResult.mergedCategories) {
    catStore.put(cat);
  }
  const threadStore = writeTx.objectStore(STORE_THREADS);
  for (const th of mergeResult.mergedThreads) {
    threadStore.put(th);
  }
  const eventStore = writeTx.objectStore(STORE_EVENTS);
  for (const ev of mergeResult.mergedEvents) {
    eventStore.put(ev);
  }
  const attStore = writeTx.objectStore(STORE_ATTACHMENTS);
  for (const ser of mergeResult.newAttachmentsToStore) {
    const bytes = base64ToBytes(ser.dataBase64);
    const copy = new Uint8Array(bytes.length);
    copy.set(bytes);
    const record: AttachmentRecord = {
      id: ser.id,
      eventId: ser.eventId,
      name: ser.name,
      mimeType: ser.mimeType,
      size: ser.size,
      createdAt: ser.createdAt,
      blob: new Blob([copy], { type: ser.mimeType || 'application/octet-stream' }),
    };
    attStore.put(record);
  }

  await txDone(writeTx);

  const sortedCategories = [...mergeResult.mergedCategories].sort((a, b) => a.order - b.order);
  const sortedThreads = [...mergeResult.mergedThreads].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );

  return {
    ...mergeResult,
    events: mergeResult.mergedEvents,
    categories: sortedCategories,
    threads: sortedThreads,
  };
}

export interface StorageUsageReport {
  usageBytes: number | null;
  quotaBytes: number | null;
  attachmentsBytes: number;
  attachmentsCount: number;
}

export async function estimateLocalStorageUsage(): Promise<StorageUsageReport> {
  const attachments = await getAllAttachments();
  const attachmentsBytes = attachments.reduce((sum, item) => sum + (item.size || 0), 0);

  let usageBytes: number | null = null;
  let quotaBytes: number | null = null;

  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const est = await navigator.storage.estimate();
      usageBytes = typeof est.usage === 'number' ? est.usage : null;
      quotaBytes = typeof est.quota === 'number' ? est.quota : null;
    } catch {
      // Ignore if browser blocks estimate
    }
  }

  return {
    usageBytes,
    quotaBytes,
    attachmentsBytes,
    attachmentsCount: attachments.length,
  };
}

export async function getMetaValue<T>(key: string): Promise<T | null> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_META, 'readonly');
  const res = await reqToPromise<{ key: string; value: T } | undefined>(
    tx.objectStore(STORE_META).get(key),
  );
  await txDone(tx);
  return res ? res.value : null;
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  const db = await openDatabase();
  const tx = db.transaction(STORE_META, 'readwrite');
  tx.objectStore(STORE_META).put({ key, value });
  await txDone(tx);
}
