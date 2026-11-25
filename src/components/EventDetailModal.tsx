import React, { useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  Clock,
  Download,
  Edit3,
  FileText,
  GitBranch,
  MapPin,
  Pin,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import { CATEGORY_COLOR_META } from '../domain/defaults';
import { RECURRENCE_LABELS, REMINDER_OFFSET_LABELS } from '../domain/phase2';
import { formatEventGregorianDate, getRelativeTimeLabel } from '../domain/timeline';
import type {
  AttachmentRecord,
  Category,
  DateParts,
  EventThread,
  TimelineEvent,
} from '../domain/types';
import { getAttachmentsForEvent } from '../storage/db';

interface EventDetailModalProps {
  event: TimelineEvent;
  category?: Category;
  thread?: EventThread;
  today: DateParts;
  onClose: () => void;
  onEdit: (event: TimelineEvent) => void;
  onDelete: (eventId: string) => Promise<void>;
  onTogglePin: (event: TimelineEvent) => Promise<void>;
}

interface AttachmentPreview {
  record: AttachmentRecord;
  url: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({
  event,
  category,
  thread,
  today,
  onClose,
  onEdit,
  onDelete,
  onTogglePin,
}) => {
  const [previews, setPreviews] = useState<AttachmentPreview[]>([]);
  const [loadingAtts, setLoadingAtts] = useState(event.attachmentIds.length > 0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const colorMeta = CATEGORY_COLOR_META[category?.colorKey ?? 'slate'];
  const gregorianText = formatEventGregorianDate(event);
  const relativeText = getRelativeTimeLabel(event, today);

  useEffect(() => {
    let active = true;
    const createdUrls: string[] = [];

    if (event.attachmentIds.length === 0) {
      setPreviews([]);
      setLoadingAtts(false);
      return;
    }

    setLoadingAtts(true);
    getAttachmentsForEvent(event.id)
      .then((records) => {
        if (!active) return;
        const mapped = records.map((record) => {
          const url = URL.createObjectURL(record.blob);
          createdUrls.push(url);
          return { record, url };
        });
        setPreviews(mapped);
      })
      .catch(() => {
        if (active) setPreviews([]);
      })
      .finally(() => {
        if (active) setLoadingAtts(false);
      });

    return () => {
      active = false;
      for (const url of createdUrls) {
        URL.revokeObjectURL(url);
      }
    };
  }, [event.id, event.attachmentIds.length]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(event.id);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detail-modal-title"
    >
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FAF8F4] dark:bg-[#1E1D1B] shadow-2xl overflow-hidden">
        {/* Sheet Header */}
        <div className="flex items-center justify-between gap-3 border-b border-stone-200 dark:border-stone-800 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium min-w-0">
            <span className={`inline-flex items-center gap-1.5 ${colorMeta.textClass}`}>
              <span className={`h-2 w-2 rounded-full ${colorMeta.dotClass}`} aria-hidden="true" />
              {category?.name ?? 'عام'}
            </span>
            <span aria-hidden="true" className="text-stone-400">·</span>
            <span className="text-stone-600 dark:text-stone-300">{relativeText}</span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onTogglePin(event)}
              aria-label={event.isPinned ? 'إلغاء تثبيت الحدث' : 'تثبيت الحدث في القادمة'}
              aria-pressed={!!event.isPinned}
              className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors cursor-pointer ${
                event.isPinned
                  ? 'border-[#8C3B2B] dark:border-[#E28A6D] bg-[#8C3B2B]/10 dark:bg-[#E28A6D]/15 text-[#8C3B2B] dark:text-[#E28A6D]'
                  : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
              }`}
            >
              <Pin className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{event.isPinned ? 'مثبت' : 'تثبيت'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق تفاصيل الحدث"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-6 sm:px-7">
          <h2
            id="detail-modal-title"
            className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 leading-snug break-words"
          >
            {event.title}
          </h2>

          {/* Description (Directly below Title) */}
          {event.description ? (
            <p className="mt-2.5 whitespace-pre-line text-sm sm:text-base leading-relaxed text-stone-700 dark:text-stone-300 break-words">
              {event.description}
            </p>
          ) : (
            <p className="mt-2 text-xs sm:text-sm text-stone-400 dark:text-stone-500 italic">
              لا توجد تفاصيل إضافية مسجلة لهذا الحدث.
            </p>
          )}

          {/* Dates Card: Gregorian and Hijri on the same row */}
          <div className="mt-4 rounded-xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#141413] p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-3 sm:gap-4 divide-x divide-x-reverse divide-stone-200/80 dark:divide-stone-800">
              <div className="flex items-start gap-2 sm:gap-2.5 min-w-0 pr-1">
                <Calendar className="w-4 h-4 mt-0.5 text-[#8C3B2B] dark:text-[#E28A6D] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <span className="block text-xs text-stone-500 dark:text-stone-400">التاريخ الميلادي</span>
                  <p className="mt-0.5 text-xs sm:text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100 break-words">
                    {gregorianText}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 sm:gap-2.5 min-w-0 pr-2 sm:pr-4">
                <Calendar className="w-4 h-4 mt-0.5 text-[#8C3B2B] dark:text-[#E28A6D] shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <span className="block text-xs text-stone-500 dark:text-stone-400">التاريخ الهجري</span>
                  <p className="mt-0.5 text-xs sm:text-sm font-semibold tabular-nums text-stone-900 dark:text-stone-100 break-words">
                    {event.hijriFormatted}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Secondary Info: Time, Location, Thread, Recurrence */}
          {(event.time || event.location || thread || event.recurrence) && (
            <dl className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-[#141413] p-3.5 text-xs sm:text-sm">
              {event.time && (
                <div className="flex items-start gap-2.5 min-w-0">
                  <Clock className="w-4 h-4 mt-0.5 text-stone-500 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-stone-500 dark:text-stone-400">الوقت</dt>
                    <dd className="mt-0.5 font-medium tabular-nums text-stone-900 dark:text-stone-100">
                      {event.time}
                    </dd>
                  </div>
                </div>
              )}

              {event.location && (
                <div className="flex items-start gap-2.5 min-w-0">
                  <MapPin className="w-4 h-4 mt-0.5 text-stone-500 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-stone-500 dark:text-stone-400">الموقع</dt>
                    <dd className="mt-0.5 font-medium text-stone-900 dark:text-stone-100 break-words">
                      {event.location}
                    </dd>
                  </div>
                </div>
              )}

              {thread && (
                <div className="flex items-start gap-2.5 min-w-0">
                  <GitBranch className="w-4 h-4 mt-0.5 text-[#8C3B2B] dark:text-[#E28A6D] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-stone-500 dark:text-stone-400">السلسلة الموضوعية</dt>
                    <dd className="mt-0.5 font-medium text-stone-900 dark:text-stone-100 break-words">
                      {thread.title}
                    </dd>
                  </div>
                </div>
              )}

              {event.recurrence && (
                <div className="flex items-start gap-2.5 min-w-0">
                  <Repeat className="w-4 h-4 mt-0.5 text-[#8C3B2B] dark:text-[#E28A6D] shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-stone-500 dark:text-stone-400">التكرار الدوري</dt>
                    <dd className="mt-0.5 font-medium text-stone-900 dark:text-stone-100 break-words">
                      {RECURRENCE_LABELS[event.recurrence.frequency]} (
                      {event.recurrence.calendar === 'hijri' ? 'هجري' : 'ميلادي'})
                      {event.recurrence.endDate ? ` · حتى ${event.recurrence.endDate}` : ''}
                    </dd>
                  </div>
                </div>
              )}
            </dl>
          )}

          {/* Reminders */}
          {event.reminders && event.reminders.length > 0 && (
            <div className="mt-3.5 rounded-xl border border-stone-200/80 dark:border-stone-800 bg-white dark:bg-[#141413] p-4">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
                <Bell className="w-3.5 h-3.5 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
                <span>التذكيرات المفعّلة</span>
              </h3>
              <p className="mt-1.5 text-sm font-medium text-stone-800 dark:text-stone-200 break-words">
                {event.reminders
                  .map((r) => `${REMINDER_OFFSET_LABELS[r.offset]}${r.time ? ` (${r.time})` : ''}`)
                  .join(' · ')}
              </p>
            </div>
          )}

          {/* Keywords */}
          {event.keywords.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-medium text-stone-500 dark:text-stone-400">
                الكلمات المفتاحية
              </h3>
              <p className="mt-1.5 text-sm text-stone-700 dark:text-stone-300 break-words">
                {event.keywords.join(' · ')}
              </p>
            </div>
          )}

          {/* Attachments */}
          {(loadingAtts || previews.length > 0) && (
            <div className="mt-6">
              <h3 className="text-xs font-medium text-stone-500 dark:text-stone-400">
                الصور والمرفقات ({event.attachmentIds.length})
              </h3>
              {loadingAtts ? (
                <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">
                  جارٍ تحميل المرفقات من الذاكرة المحلية...
                </p>
              ) : (
                <div className="mt-3 space-y-3">
                  {previews.map(({ record, url }) => {
                    const isImage = record.mimeType.startsWith('image/');
                    return (
                      <div
                        key={record.id}
                        className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141413] overflow-hidden"
                      >
                        {isImage && (
                          <img
                            src={url}
                            alt={record.name}
                            className="max-h-80 w-full object-contain bg-stone-100 dark:bg-stone-900"
                          />
                        )}
                        <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 shrink-0 text-stone-500" aria-hidden="true" />
                            <span className="truncate font-medium text-stone-800 dark:text-stone-200">
                              {record.name}
                            </span>
                            <span className="tabular-nums text-stone-500 shrink-0">
                              ({formatFileSize(record.size)})
                            </span>
                          </div>
                          <a
                            href={url}
                            download={record.name}
                            className="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium text-[#8C3B2B] dark:text-[#E28A6D] hover:bg-stone-100 dark:hover:bg-stone-800 shrink-0"
                          >
                            <Download className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>تنزيل</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="border-t border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#141413]/70 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
              <span>حذف</span>
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="min-h-[44px] rounded-xl bg-red-700 hover:bg-red-800 px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 cursor-pointer"
              >
                {deleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 px-3.5 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                تراجع
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => onEdit(event)}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-5 py-2 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            <Edit3 className="w-4 h-4" aria-hidden="true" />
            <span>تعديل الحدث</span>
          </button>
        </div>
      </div>
    </div>
  );
};
