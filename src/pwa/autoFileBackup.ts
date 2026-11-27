import type { TimelineBackupPayload } from '../domain/backup';
import { getMetaValue, setMetaValue } from '../storage/db';

const META_FILE_HANDLE_KEY = 'linkedBackupFileHandle';
const META_BACKUP_STATUS_KEY = 'backupSyncStatus';

export interface BackupSyncStatus {
  lastAutoSnapshotAt: string | null;
  lastExportedAt: string | null;
  unsavedChangesCount: number;
  linkedFileName: string | null;
  lastFileSyncedAt: string | null;
}

interface WritableLike {
  write: (data: string) => Promise<void>;
  close: () => Promise<void>;
}

interface FileHandleLike {
  name: string;
  queryPermission?: (opts: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission?: (opts: { mode: 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  createWritable: () => Promise<WritableLike>;
}

type ShowSaveFilePickerFn = (options?: {
  suggestedName?: string;
  types?: Array<{ description?: string; accept: Record<string, string[]> }>;
}) => Promise<FileHandleLike>;

export const DEFAULT_BACKUP_SYNC_STATUS: BackupSyncStatus = {
  lastAutoSnapshotAt: null,
  lastExportedAt: null,
  unsavedChangesCount: 0,
  linkedFileName: null,
  lastFileSyncedAt: null,
};

export function isAutoFileBackupSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as { showSaveFilePicker?: unknown }).showSaveFilePicker === 'function'
  );
}

export async function getBackupSyncStatus(): Promise<BackupSyncStatus> {
  const saved = await getMetaValue<BackupSyncStatus>(META_BACKUP_STATUS_KEY);
  return {
    ...DEFAULT_BACKUP_SYNC_STATUS,
    ...(saved ?? {}),
  };
}

export async function linkBackupFileOnDevice(
  initialPayload: TimelineBackupPayload,
): Promise<BackupSyncStatus> {
  const picker = (window as unknown as { showSaveFilePicker?: ShowSaveFilePickerFn })
    .showSaveFilePicker;
  if (!picker) {
    throw new Error('متصفحك الحالي لا يدعم الكتابة المباشرة على ملفات الجهاز.');
  }

  const handle = await picker({
    suggestedName: 'timeline-auto-backup.json',
    types: [
      {
        description: 'Timeline JSON Backup',
        accept: { 'application/json': ['.json'] },
      },
    ],
  });

  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(initialPayload, null, 2));
  await writable.close();

  const nowIso = new Date().toISOString();
  const prev = await getBackupSyncStatus();
  const next: BackupSyncStatus = {
    ...prev,
    lastExportedAt: nowIso,
    lastFileSyncedAt: nowIso,
    unsavedChangesCount: 0,
    linkedFileName: handle.name,
  };

  await setMetaValue(META_FILE_HANDLE_KEY, handle);
  await setMetaValue(META_BACKUP_STATUS_KEY, next);
  return next;
}

export async function unlinkBackupFileOnDevice(): Promise<BackupSyncStatus> {
  await setMetaValue(META_FILE_HANDLE_KEY, null);
  const prev = await getBackupSyncStatus();
  const next: BackupSyncStatus = {
    ...prev,
    linkedFileName: null,
    lastFileSyncedAt: null,
  };
  await setMetaValue(META_BACKUP_STATUS_KEY, next);
  return next;
}

export async function markManualBackupExported(): Promise<BackupSyncStatus> {
  const nowIso = new Date().toISOString();
  const prev = await getBackupSyncStatus();
  const next: BackupSyncStatus = {
    ...prev,
    lastExportedAt: nowIso,
    unsavedChangesCount: 0,
  };
  await setMetaValue(META_BACKUP_STATUS_KEY, next);
  return next;
}

export async function syncAutoBackupOnChange(
  buildPayload: () => Promise<TimelineBackupPayload>,
): Promise<BackupSyncStatus> {
  const nowIso = new Date().toISOString();
  const prev = await getBackupSyncStatus();

  // Request persistent storage silently so browser won't evict IndexedDB under pressure
  if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
    navigator.storage.persist().catch(() => {});
  }

  let next: BackupSyncStatus = {
    ...prev,
    lastAutoSnapshotAt: nowIso,
    unsavedChangesCount: prev.unsavedChangesCount + 1,
  };

  // Attempt silent write to linked local file if user granted permission earlier
  if (prev.linkedFileName) {
    try {
      const handle = await getMetaValue<FileHandleLike | null>(META_FILE_HANDLE_KEY);
      if (handle && typeof handle.createWritable === 'function') {
        const perm = handle.queryPermission
          ? await handle.queryPermission({ mode: 'readwrite' })
          : 'granted';
        if (perm === 'granted') {
          const payload = await buildPayload();
          const writable = await handle.createWritable();
          await writable.write(JSON.stringify(payload, null, 2));
          await writable.close();
          next = {
            ...next,
            lastExportedAt: nowIso,
            lastFileSyncedAt: nowIso,
            unsavedChangesCount: 0,
          };
        }
      }
    } catch {
      // Non-blocking: keep unsavedChangesCount incremented so user sees reminder
    }
  }

  await setMetaValue(META_BACKUP_STATUS_KEY, next);
  return next;
}

export async function syncLinkedBackupNow(
  buildPayload: () => Promise<TimelineBackupPayload>,
): Promise<BackupSyncStatus> {
  const prev = await getBackupSyncStatus();
  if (!prev.linkedFileName) {
    throw new Error('لا يوجد ملف مربوط حاليًا.');
  }

  const handle = await getMetaValue<FileHandleLike | null>(META_FILE_HANDLE_KEY);
  if (!handle || typeof handle.createWritable !== 'function') {
    throw new Error('تعذر الوصول إلى الملف المربوط، يرجى إلغاء الربط ثم إعادة ربطه.');
  }

  let perm: 'granted' | 'denied' | 'prompt' = handle.queryPermission
    ? await handle.queryPermission({ mode: 'readwrite' })
    : 'granted';

  if (perm !== 'granted' && handle.requestPermission) {
    perm = await handle.requestPermission({ mode: 'readwrite' });
  }

  if (perm !== 'granted') {
    throw new Error('لم تُمنح صلاحية الكتابة على الملف المربوط. يرجى الموافقة أو إعادة ربط الملف.');
  }

  const payload = await buildPayload();
  const writable = await handle.createWritable();
  await writable.write(JSON.stringify(payload, null, 2));
  await writable.close();

  const nowIso = new Date().toISOString();
  const next: BackupSyncStatus = {
    ...prev,
    lastExportedAt: nowIso,
    lastFileSyncedAt: nowIso,
    unsavedChangesCount: 0,
  };
  await setMetaValue(META_BACKUP_STATUS_KEY, next);
  return next;
}
