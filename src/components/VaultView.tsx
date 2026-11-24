import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FolderKanban,
  HardDrive,
  Link2,
  Lock,
  Moon,
  Printer,
  Shield,
  Sun,
  Type as TypeIcon,
  Unlink,
  Unlock,
  Upload,
} from 'lucide-react';
import {
  generateExcelSpreadsheetXml,
  generatePrintableArchiveHtml,
  isValidBackupPayload,
  type TimelineBackupPayload,
} from '../domain/backup';
import {
  decryptBackupPayload,
  encryptBackupPayload,
  hashPin,
  isEncryptedBackupEnvelope,
  type EncryptedBackupEnvelope,
  type PinHashRecord,
} from '../domain/cryptoVault';
import { formatTodayHeader } from '../domain/timeline';
import type { Category, DateParts, EventThread, TimelineEvent } from '../domain/types';
import {
  isAutoFileBackupSupported,
  linkBackupFileOnDevice,
  markManualBackupExported,
  unlinkBackupFileOnDevice,
  type BackupSyncStatus,
} from '../pwa/autoFileBackup';
import {
  estimateLocalStorageUsage,
  exportFullBackup,
  importFullBackup,
  type StorageUsageReport,
} from '../storage/db';

interface VaultViewProps {
  events: TimelineEvent[];
  categories: Category[];
  threads: EventThread[];
  categoriesMap: Map<string, Category>;
  threadsMap: Map<string, EventThread>;
  today: DateParts;
  theme: 'light' | 'dark';
  fontScale: 'normal' | 'large';
  pinConfigured: boolean;
  backupSyncStatus: BackupSyncStatus;
  onBackupSyncStatusChange: (status: BackupSyncStatus) => void;
  onToggleTheme: () => void;
  onChangeFontScale: (scale: 'normal' | 'large') => void;
  onOpenCategories: () => void;
  onSetPin: (record: PinHashRecord | null) => Promise<void>;
  onLockNow: () => void;
  onRestoreComplete: (next: {
    events: TimelineEvent[];
    categories: Category[];
    threads: EventThread[];
  }) => void;
}

function formatStorageSize(bytes: number | null): string {
  if (bytes === null) return 'غير متاح';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const VaultView: React.FC<VaultViewProps> = ({
  events,
  categories,
  threads,
  categoriesMap,
  threadsMap,
  today,
  theme,
  fontScale,
  pinConfigured,
  backupSyncStatus,
  onBackupSyncStatusChange,
  onToggleTheme,
  onChangeFontScale,
  onOpenCategories,
  onSetPin,
  onLockNow,
  onRestoreComplete,
}) => {
  const [storageReport, setStorageReport] = useState<StorageUsageReport | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Encrypted backup passphrase
  const [showEncryptBox, setShowEncryptBox] = useState(false);
  const [encryptPass, setEncryptPass] = useState('');

  // Pending encrypted import awaiting passphrase
  const [pendingEncryptedEnvelope, setPendingEncryptedEnvelope] =
    useState<EncryptedBackupEnvelope | null>(null);
  const [decryptPass, setDecryptPass] = useState('');

  // PIN management
  const [pinDraft, setPinDraft] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const printFrameRef = useRef<HTMLIFrameElement | null>(null);

  const refreshStorage = () => {
    estimateLocalStorageUsage().then(setStorageReport).catch(() => {});
  };

  useEffect(() => {
    refreshStorage();
  }, [events.length]);

  const clearFeedback = () => {
    setStatusMessage(null);
    setErrorMessage(null);
  };

  const handleExportJson = async () => {
    clearFeedback();
    setBusyMessage('جارٍ تجهيز النسخة الاحتياطية الكاملة...');
    try {
      const payload = await exportFullBackup();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const dateTag = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
      triggerDownload(blob, `timeline-backup-${dateTag}.json`);
      const nextSync = await markManualBackupExported();
      onBackupSyncStatusChange(nextSync);
      setStatusMessage(
        `تم تصدير النسخة الاحتياطية (${payload.events.length} حدثًا و ${payload.attachments.length} مرفقًا).`,
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر تصدير النسخة الاحتياطية.');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleExportEncrypted = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setBusyMessage('جارٍ تشفير الأرشيف بـ AES-256-GCM...');
    try {
      const payload = await exportFullBackup();
      const envelope = await encryptBackupPayload(JSON.stringify(payload), encryptPass);
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: 'application/json;charset=utf-8',
      });
      const dateTag = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
      triggerDownload(blob, `timeline-encrypted-${dateTag}.tlvault.json`);
      const nextSync = await markManualBackupExported();
      onBackupSyncStatusChange(nextSync);
      setEncryptPass('');
      setShowEncryptBox(false);
      setStatusMessage('تم تصدير النسخة الاحتياطية المشفرة بنجاح.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر تشفير النسخة الاحتياطية.');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleLinkAutoBackupFile = async () => {
    clearFeedback();
    setBusyMessage('جارٍ تجهيز وربط ملف النسخ التلقائي على الجهاز...');
    try {
      const payload = await exportFullBackup();
      const nextSync = await linkBackupFileOnDevice(payload);
      onBackupSyncStatusChange(nextSync);
      setStatusMessage(
        `تم ربط ملف النسخ التلقائي (${nextSync.linkedFileName}). سيتم تحديثه تلقائيًا بعد أي إضافة أو تعديل.`,
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setErrorMessage(err instanceof Error ? err.message : 'تعذر ربط ملف النسخ التلقائي.');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleUnlinkAutoBackupFile = async () => {
    clearFeedback();
    try {
      const nextSync = await unlinkBackupFileOnDevice();
      onBackupSyncStatusChange(nextSync);
      setStatusMessage('تم إلغاء ربط ملف النسخ التلقائي.');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'تعذر إلغاء ربط الملف.');
    }
  };

  const executeRestore = async (payload: TimelineBackupPayload) => {
    const res = await importFullBackup(payload);
    onRestoreComplete({
      events: res.events,
      categories: res.categories,
      threads: res.threads,
    });
    refreshStorage();
    setStatusMessage(
      `تمت الاستعادة بنجاح: أُضيف ${res.addedEventsCount} حدثًا، و${res.addedAttachmentsCount} مرفقًا، وتم تخطي ${res.skippedDuplicateEventsCount} حدثًا مكررًا.`,
    );
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    clearFeedback();
    setPendingEncryptedEnvelope(null);
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setBusyMessage('جارٍ قراءة ملف النسخة الاحتياطية...');
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;

      if (isEncryptedBackupEnvelope(parsed)) {
        setPendingEncryptedEnvelope(parsed);
        setBusyMessage(null);
        return;
      }

      if (!isValidBackupPayload(parsed)) {
        throw new Error('صيغة ملف النسخة الاحتياطية غير صالحة أو لا تخص Timeline.');
      }

      await executeRestore(parsed);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'تعذر استيراد النسخة الاحتياطية.',
      );
    } finally {
      setBusyMessage(null);
    }
  };

  const handleDecryptAndRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingEncryptedEnvelope) return;
    clearFeedback();
    setBusyMessage('جارٍ فك التشفير والاستعادة...');
    try {
      const plaintext = await decryptBackupPayload(pendingEncryptedEnvelope, decryptPass);
      const parsed = JSON.parse(plaintext) as unknown;
      if (!isValidBackupPayload(parsed)) {
        throw new Error('البيانات المفكوكة لا تحتوي على نسخة صالحة.');
      }
      await executeRestore(parsed);
      setPendingEncryptedEnvelope(null);
      setDecryptPass('');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'فشل فك التشفير.');
    } finally {
      setBusyMessage(null);
    }
  };

  const handleExportExcel = () => {
    clearFeedback();
    const xml = generateExcelSpreadsheetXml(events, categoriesMap, threadsMap);
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const dateTag = `${today.year}-${String(today.month).padStart(2, '0')}-${String(today.day).padStart(2, '0')}`;
    triggerDownload(blob, `timeline-archive-${dateTag}.xls`);
    setStatusMessage('تم تصدير ملف Excel بنجاح.');
  };

  const handleExportPdfPrint = () => {
    clearFeedback();
    const todayLabels = formatTodayHeader(today);
    const html = generatePrintableArchiveHtml(
      events,
      categoriesMap,
      threadsMap,
      `${todayLabels.gregorian} (${todayLabels.hijri})`,
    );

    let iframe = printFrameRef.current;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
      printFrameRef.current = iframe;
    }

    const doc = iframe.contentDocument;
    if (!doc) {
      setErrorMessage('تعذر تجهيز مستند الطباعة.');
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe?.contentWindow?.focus();
      iframe?.contentWindow?.print();
    }, 200);
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!/^\d{4,8}$/.test(pinDraft.trim())) {
      setPinError('يجب أن يتكون الرمز السري من 4 إلى 8 أرقام فقط.');
      return;
    }
    if (pinDraft.trim() !== pinConfirm.trim()) {
      setPinError('الرمزان غير متطابقين.');
      return;
    }
    const record = await hashPin(pinDraft.trim());
    await onSetPin(record);
    setPinDraft('');
    setPinConfirm('');
    setStatusMessage('تم حفظ رمز القفل الأمني محليًا بنجاح.');
  };

  const handleRemovePin = async () => {
    await onSetPin(null);
    setStatusMessage('تم إلغاء القفل الأمني للتطبيق.');
  };

  const quotaPct =
    storageReport && storageReport.usageBytes !== null && storageReport.quotaBytes
      ? Math.min(100, Math.max(1, Math.round((storageReport.usageBytes / storageReport.quotaBytes) * 100)))
      : null;

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 [text-wrap:balance]">
          الأمان والنسخ الاحتياطي والتصدير
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          تحكم كامل في حماية أرشيفك بقفل رقمي، النسخ الاحتياطي المشفر، التصدير، ومراقبة مساحة التخزين المحلية.
        </p>
      </div>

      {busyMessage && (
        <div role="status" className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1D1B] p-4 text-sm text-stone-700 dark:text-stone-200">
          {busyMessage}
        </div>
      )}

      {statusMessage && (
        <div role="status" className="rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 p-4 text-sm text-emerald-900 dark:text-emerald-200">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div role="alert" className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Backup & Restore Card */}
        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Download className="w-5 h-5 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              النسخ الاحتياطي والاستعادة (مع المرفقات)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            يحفظ ملف النسخ الاحتياطي جميع الأحداث، التصنيفات، السلاسل، والصور والمرفقات مع منع تلقائي للتكرار عند الاستيراد.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportJson}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-4 py-2 text-xs sm:text-sm font-medium text-white cursor-pointer"
            >
              <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>نسخة احتياطية JSON</span>
            </button>

            <button
              type="button"
              onClick={() => setShowEncryptBox((v) => !v)}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-4 py-2 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              <Lock className="w-4 h-4 shrink-0 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
              <span>نسخة مشفرة</span>
            </button>
          </div>

          {showEncryptBox && (
            <form onSubmit={handleExportEncrypted} className="rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] p-3.5 space-y-3">
              <label htmlFor="enc-pass-input" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
                كلمة مرور تشفير النسخة (AES-256-GCM)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="enc-pass-input"
                  type="password"
                  value={encryptPass}
                  onChange={(e) => setEncryptPass(e.target.value)}
                  placeholder="4 أحرف على الأقل..."
                  className="flex-1 min-w-0 min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1E1D1B] px-3 text-sm"
                />
                <button
                  type="submit"
                  className="min-h-[40px] rounded-lg bg-[#8C3B2B] px-3.5 text-xs font-medium text-white cursor-pointer shrink-0"
                >
                  تشفير وتنزيل
                </button>
              </div>
            </form>
          )}

          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <label className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-stone-300 dark:border-stone-700 px-4 py-2.5 text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800/60 cursor-pointer">
              <Upload className="w-4 h-4 shrink-0 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
              <span>استيراد واستعادة نسخة (.json أو .tlvault.json)</span>
              <input
                type="file"
                accept=".json,.tlvault.json,application/json"
                onChange={handleFileImport}
                className="sr-only"
              />
            </label>
          </div>

          {pendingEncryptedEnvelope && (
            <form onSubmit={handleDecryptAndRestore} className="rounded-xl border border-[#8C3B2B]/40 bg-[#FAF8F4] dark:bg-[#141413] p-3.5 space-y-3">
              <p className="text-xs font-bold text-[#8C3B2B] dark:text-[#E28A6D]">
                هذا الملف مشفر — أدخل كلمة المرور لفك التشفير والاستعادة
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={decryptPass}
                  onChange={(e) => setDecryptPass(e.target.value)}
                  placeholder="كلمة مرور النسخة المشفرة"
                  className="flex-1 min-w-0 min-h-[40px] rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1E1D1B] px-3 text-sm"
                />
                <button
                  type="submit"
                  className="min-h-[40px] rounded-lg bg-[#8C3B2B] px-3.5 text-xs font-medium text-white cursor-pointer shrink-0"
                >
                  فك واستيراد
                </button>
              </div>
            </form>
          )}
          {/* Auto-Backup Status & Linking Panel */}
          <div className="rounded-xl border border-stone-200 dark:border-stone-700/80 bg-[#FAF8F4] dark:bg-[#141413] p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>النسخ التلقائي وحالة الحفظ</span>
              </span>
              {backupSyncStatus.unsavedChangesCount > 0 ? (
                <span className="text-[11px] font-medium text-[#8C3B2B] dark:text-[#E28A6D] tabular-nums">
                  {backupSyncStatus.unsavedChangesCount} تعديلات غير مصدّرة خارجيًا
                </span>
              ) : (
                <span className="text-[11px] text-emerald-700 dark:text-emerald-400">
                  محدّث بالكامل
                </span>
              )}
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed">
              تُحفظ كل التعديلات تلقائيًا وفوريًا في ذاكرة الجهاز الدائمة (IndexedDB)
              {backupSyncStatus.lastAutoSnapshotAt
                ? ` · آخر حفظ داخلي: ${new Date(backupSyncStatus.lastAutoSnapshotAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`
                : '.'}
            </p>

            {isAutoFileBackupSupported() ? (
              backupSyncStatus.linkedFileName ? (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-200/80 dark:border-stone-800">
                  <div className="min-w-0 text-xs text-stone-800 dark:text-stone-200">
                    <span className="font-semibold">مربوط مع: </span>
                    <span dir="ltr" className="font-mono text-[11px] break-all">
                      {backupSyncStatus.linkedFileName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUnlinkAutoBackupFile}
                    className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-stone-300 dark:border-stone-700 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer shrink-0"
                  >
                    <Unlink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>إلغاء الربط</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleLinkAutoBackupFile}
                  className="w-full min-h-[40px] inline-flex items-center justify-center gap-2 rounded-lg border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white dark:bg-[#1E1D1B] px-3 py-2 text-xs font-medium text-[#8C3B2B] dark:text-[#E28A6D] hover:bg-[#8C3B2B]/5 dark:hover:bg-[#E28A6D]/10 cursor-pointer"
                >
                  <Link2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>ربط ملف نسخ تلقائي على الجهاز (تحديث صامت بعد كل تعديل)</span>
                </button>
              )
            ) : (
              <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-relaxed pt-1 border-t border-stone-200/80 dark:border-stone-800">
                لحماية خصوصيتك، تمنع متصفحات الهواتف الكتابة الصامتة على مجلد التنزيلات تلقائيًا؛ يُحفظ أرشيفك تلقائيًا داخل التطبيق ويمكنك تنزيل نسخة خارجية بضغطة واحدة أعلاه.
              </p>
            )}
          </div>
        </div>

        {/* Reports Export Card (Excel / PDF) */}
        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              تصدير التقارير (Excel و PDF)
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
            صدّر جدول أحداثك منظمًا باللغة العربية بصيغة Excel أو اطبعه واحفظه كملف PDF منسق للطباعة والأرشفة.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={handleExportExcel}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-4 py-2 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
              <span>تصدير Excel (.xls)</span>
            </button>

            <button
              type="button"
              onClick={handleExportPdfPrint}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-4 py-2 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
              <span>تصدير / طباعة PDF</span>
            </button>
          </div>

          {/* Storage Monitor */}
          <div className="pt-4 border-t border-stone-100 dark:border-stone-800 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-stone-900 dark:text-stone-100">
                <HardDrive className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
                <span>مراقبة السعة المحلية</span>
              </span>
              <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400">
                {events.length} حدث · {threads.length} سلسلة · {categories.length} تصنيف
              </span>
            </div>

            {storageReport && (
              <div className="space-y-2 text-xs text-stone-600 dark:text-stone-400 tabular-nums">
                <div className="flex items-center justify-between">
                  <span>حجم المرفقات ({storageReport.attachmentsCount}):</span>
                  <span dir="ltr" className="font-semibold text-stone-900 dark:text-stone-100">
                    {formatStorageSize(storageReport.attachmentsBytes)}
                  </span>
                </div>
                {storageReport.usageBytes !== null && (
                  <div className="flex items-center justify-between">
                    <span>المساحة المستخدمة / المتاحة:</span>
                    <span dir="ltr" className="font-semibold text-stone-900 dark:text-stone-100">
                      {formatStorageSize(storageReport.usageBytes)} / {formatStorageSize(storageReport.quotaBytes)}
                    </span>
                  </div>
                )}
                {quotaPct !== null && (
                  <div className="h-2 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#8C3B2B] dark:bg-[#E28A6D]"
                      style={{ width: `${quotaPct}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Security PIN Lock Card */}
        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
              <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
                قفل التطبيق برمز سري (PIN)
              </h2>
            </div>
            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
              {pinConfigured ? 'مفعّل' : 'غير مفعّل'}
            </span>
          </div>

          <form onSubmit={handleSavePin} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinDraft}
                onChange={(e) => setPinDraft(e.target.value)}
                aria-label="الرمز السري الجديد"
                placeholder={pinConfigured ? 'رمز سري جديد (4-8 أرقام)' : 'أدخل 4 إلى 8 أرقام'}
                className="w-full min-h-[42px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-sm tabular-nums"
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value)}
                aria-label="تأكيد الرمز السري"
                placeholder="تأكيد الرمز السري"
                className="w-full min-h-[42px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-sm tabular-nums"
              />
            </div>

            {pinError && (
              <p role="alert" className="text-xs text-red-600 dark:text-red-400">
                {pinError}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="min-h-[42px] inline-flex items-center gap-1.5 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-4 py-2 text-xs sm:text-sm font-medium text-white cursor-pointer"
              >
                <Lock className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{pinConfigured ? 'تحديث الرمز السري' : 'تفعيل القفل'}</span>
              </button>

              {pinConfigured && (
                <>
                  <button
                    type="button"
                    onClick={onLockNow}
                    className="min-h-[42px] rounded-xl border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                  >
                    قفل التطبيق الآن
                  </button>
                  <button
                    type="button"
                    onClick={handleRemovePin}
                    className="min-h-[42px] inline-flex items-center gap-1 rounded-xl border border-red-200 dark:border-red-900 px-3.5 py-2 text-xs sm:text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                  >
                    <Unlock className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>إلغاء القفل</span>
                  </button>
                </>
              )}
            </div>
          </form>
        </div>

        {/* Appearance & Categories Card */}
        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TypeIcon className="w-5 h-5 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
            <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">
              تخصيص المظهر والقراءة
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onToggleTheme}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-4 py-2 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 cursor-pointer"
            >
              {theme === 'light' ? (
                <>
                  <Moon className="w-4 h-4 text-[#8C3B2B]" aria-hidden="true" />
                  <span>الوضع الداكن</span>
                </>
              ) : (
                <>
                  <Sun className="w-4 h-4 text-[#E28A6D]" aria-hidden="true" />
                  <span>الوضع الفاتح</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onChangeFontScale(fontScale === 'normal' ? 'large' : 'normal')}
              className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-4 py-2 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 cursor-pointer"
            >
              <TypeIcon className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
              <span>حجم الخط: {fontScale === 'large' ? 'مكبّر' : 'قياسي'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onOpenCategories}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-2 text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
          >
            <FolderKanban className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
            <span>إدارة التصنيفات ({categories.length})</span>
          </button>
        </div>
      </div>
    </section>
  );
};
