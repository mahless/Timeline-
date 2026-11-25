import React, { useEffect, useMemo, useState } from 'react';
import { Bell, FileText, GitBranch, Paperclip, Pin, Repeat, Trash2, X } from 'lucide-react';
import {
  GREGORIAN_MONTH_NAMES,
  HIJRI_MONTH_NAMES,
  getGregorianDaysInMonth,
  gregorianToHijri,
  hijriToGregorian,
} from '../domain/hijri';
import { RECURRENCE_LABELS, REMINDER_OFFSET_LABELS } from '../domain/phase2';
import {
  formatEventGregorianDate,
  getTodayParts,
  validateEventInput,
} from '../domain/timeline';
import type {
  AttachmentRecord,
  CalendarType,
  Category,
  DatePrecision,
  EventFormInput,
  EventThread,
  RecurrenceFrequency,
  ReminderOffset,
  ReminderRule,
  TimelineEvent,
} from '../domain/types';
import { generateId, getAttachmentsForEvent } from '../storage/db';
import { compressImageFileIfBeneficial } from '../utils/imageCompression';

interface EventFormModalProps {
  editingEvent: TimelineEvent | null;
  categories: Category[];
  threads: EventThread[];
  initialThreadId?: string;
  onClose: () => void;
  onSave: (
    input: EventFormInput,
    options: {
      existingEvent?: TimelineEvent;
      newAttachments: AttachmentRecord[];
      removedAttachmentIds: string[];
      keptAttachmentIds: string[];
    },
  ) => Promise<void>;
}

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

const REMINDER_OFFSETS: ReminderOffset[] = [
  'same_day',
  'day_before',
  'week_before',
  'month_before',
];

const RECURRENCE_OPTIONS: Array<{ value: 'none' | RecurrenceFrequency; label: string }> = [
  { value: 'none', label: 'لا يتكرر' },
  { value: 'daily', label: RECURRENCE_LABELS.daily },
  { value: 'weekly', label: RECURRENCE_LABELS.weekly },
  { value: 'monthly', label: RECURRENCE_LABELS.monthly },
  { value: 'yearly', label: RECURRENCE_LABELS.yearly },
];

interface PendingAttachment {
  id: string;
  name: string;
  blob: Blob;
  mimeType: string;
  size: number;
  originalSize: number;
  wasCompressed: boolean;
  previewUrl?: string;
}

interface ExistingAttachmentPreview {
  record: AttachmentRecord;
  previewUrl?: string;
}

export const EventFormModal: React.FC<EventFormModalProps> = ({
  editingEvent,
  categories,
  threads,
  initialThreadId,
  onClose,
  onSave,
}) => {
  const today = useMemo(() => getTodayParts(), []);
  const defaultCategoryId = categories[0]?.id ?? 'cat-personal';

  const initialCal: CalendarType = editingEvent?.calendarInput ?? 'gregorian';
  const datePrecision: DatePrecision = 'exact';

  const [title, setTitle] = useState(editingEvent?.title ?? '');
  const [calendarInput, setCalendarInput] = useState<CalendarType>(initialCal);
  const [year, setYear] = useState<number>(() => {
    if (!editingEvent) return today.year;
    return initialCal === 'hijri' ? editingEvent.hijriYear : editingEvent.gregorianYear;
  });
  const [month, setMonth] = useState<number>(() => {
    if (!editingEvent) return today.month;
    return initialCal === 'hijri'
      ? (editingEvent.hijriMonth ?? 1)
      : (editingEvent.gregorianMonth ?? 1);
  });
  const [day, setDay] = useState<number>(() => {
    if (!editingEvent) return today.day;
    return initialCal === 'hijri'
      ? (editingEvent.hijriDay ?? 1)
      : (editingEvent.gregorianDay ?? 1);
  });

  const [categoryId, setCategoryId] = useState(editingEvent?.categoryId ?? defaultCategoryId);
  const [description, setDescription] = useState(editingEvent?.description ?? '');

  // Preserved from editing event if present
  const time = editingEvent?.time ?? '';
  const location = editingEvent?.location ?? '';
  const keywords = editingEvent?.keywords ?? [];

  // Phase 2 fields
  const [isPinned, setIsPinned] = useState<boolean>(!!editingEvent?.isPinned);
  const [threadId, setThreadId] = useState<string>(
    editingEvent?.threadId ?? initialThreadId ?? '',
  );
  const [recurrenceFreq, setRecurrenceFreq] = useState<'none' | RecurrenceFrequency>(
    editingEvent?.recurrence?.frequency ?? 'none',
  );
  const [recurrenceCal, setRecurrenceCal] = useState<CalendarType>(
    editingEvent?.recurrence?.calendar ?? initialCal,
  );
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<string>(
    editingEvent?.recurrence?.endDate ?? '',
  );
  const [selectedReminderOffsets, setSelectedReminderOffsets] = useState<ReminderOffset[]>(() =>
    editingEvent?.reminders ? editingEvent.reminders.map((r) => r.offset) : [],
  );
  const [reminderTime, setReminderTime] = useState<string>(
    editingEvent?.reminders?.[0]?.time ?? '',
  );

  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachmentPreview[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Load existing attachments when editing
  useEffect(() => {
    if (!editingEvent || editingEvent.attachmentIds.length === 0) return;
    let active = true;
    const urls: string[] = [];

    getAttachmentsForEvent(editingEvent.id).then((records) => {
      if (!active) return;
      setExistingAttachments(
        records.map((record) => {
          const previewUrl = record.mimeType.startsWith('image/')
            ? URL.createObjectURL(record.blob)
            : undefined;
          if (previewUrl) urls.push(previewUrl);
          return { record, previewUrl };
        }),
      );
    });

    return () => {
      active = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [editingEvent]);

  // Revoke pending image URLs on unmount
  useEffect(() => {
    return () => {
      for (const item of pendingAttachments) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      }
    };
  }, [pendingAttachments]);

  // Clamp day when month/year changes in Gregorian mode
  const maxDay = useMemo(() => {
    if (calendarInput === 'hijri') return 30;
    const safeYear = Number.isInteger(year) && year >= 1900 && year <= 2150 ? year : 2026;
    return getGregorianDaysInMonth(safeYear, month);
  }, [calendarInput, year, month]);

  useEffect(() => {
    if (day > maxDay) setDay(maxDay);
  }, [day, maxDay]);

  const handleSwitchCalendar = (nextCal: CalendarType) => {
    if (nextCal === calendarInput) return;
    if (nextCal === 'hijri') {
      const h = gregorianToHijri('exact', year, month, day);
      setYear(h.hijriYear);
      if (h.hijriMonth) setMonth(h.hijriMonth);
      if (h.hijriDay) setDay(h.hijriDay);
    } else {
      const g = hijriToGregorian('exact', year, month, day);
      setYear(g.year);
      if (g.month) setMonth(g.month);
      if (g.day) setDay(g.day);
    }
    setCalendarInput(nextCal);
  };

  // Live equivalent date preview
  const equivalentPreview = useMemo(() => {
    try {
      if (calendarInput === 'gregorian') {
        if (!Number.isInteger(year) || year < 1900 || year > 2150) return '';
        const h = gregorianToHijri('exact', year, month, day);
        return `الموافق هجريًا: ${h.formattedAr}`;
      } else {
        if (!Number.isInteger(year) || year < 1300 || year > 1580) return '';
        const g = hijriToGregorian('exact', year, month, day);
        return `الموافق ميلاديًا: ${formatEventGregorianDate({
          datePrecision: 'exact',
          gregorianYear: g.year,
          gregorianMonth: g.month,
          gregorianDay: g.day,
        })}`;
      }
    } catch {
      return '';
    }
  }, [calendarInput, year, month, day]);

  const toggleReminderOffset = (offset: ReminderOffset) => {
    setSelectedReminderOffsets((prev) =>
      prev.includes(offset) ? prev.filter((item) => item !== offset) : [...prev, offset],
    );
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    const accepted: PendingAttachment[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError(`الملف "${file.name}" يتجاوز الحد الأقصى المسموح (15 ميجابايت).`);
        continue;
      }
      const processed = await compressImageFileIfBeneficial(file);
      accepted.push({
        id: generateId(),
        name: file.name,
        blob: processed.blob,
        mimeType: processed.mimeType,
        size: processed.size,
        originalSize: processed.originalSize,
        wasCompressed: processed.wasCompressed,
        previewUrl: processed.mimeType.startsWith('image/')
          ? URL.createObjectURL(processed.blob)
          : undefined,
      });
    }

    if (accepted.length > 0) {
      setPendingAttachments((prev) => [...prev, ...accepted]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const builtReminders: ReminderRule[] | undefined =
      selectedReminderOffsets.length > 0
        ? selectedReminderOffsets.map((offset) => {
            const existing = editingEvent?.reminders?.find((r) => r.offset === offset);
            return {
              id: existing?.id ?? generateId(),
              offset,
              time: reminderTime || undefined,
            };
          })
        : undefined;

    const input: EventFormInput = {
      title,
      datePrecision: 'exact',
      calendarInput,
      year,
      month,
      day,
      time: time || undefined,
      categoryId,
      description,
      location: location || undefined,
      keywords,
      isPinned,
      threadId: threadId || undefined,
      recurrence:
        recurrenceFreq !== 'none'
          ? {
              frequency: recurrenceFreq,
              calendar: recurrenceCal,
              endDate: recurrenceEndDate || undefined,
            }
          : undefined,
      reminders: builtReminders,
    };

    const validation = validateEventInput(input);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setSubmitting(true);
    try {
      const eventId = editingEvent?.id ?? generateId();
      const nowIso = new Date().toISOString();
      const newRecords: AttachmentRecord[] = pendingAttachments.map((item) => ({
        id: item.id,
        eventId,
        name: item.name,
        mimeType: item.mimeType || 'application/octet-stream',
        size: item.size,
        createdAt: nowIso,
        blob: item.blob,
      }));

      const keptAttachmentIds = existingAttachments
        .filter((att) => !removedIds.includes(att.record.id))
        .map((att) => att.record.id);

      await onSave(input, {
        existingEvent: editingEvent ?? undefined,
        newAttachments: newRecords,
        removedAttachmentIds: removedIds,
        keptAttachmentIds,
      });
    } catch (err) {
      setErrors({
        submit: err instanceof Error ? err.message : 'تعذر حفظ الحدث في قاعدة البيانات المحلية.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const monthNames = calendarInput === 'hijri' ? HIJRI_MONTH_NAMES : GREGORIAN_MONTH_NAMES;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-form-title"
    >
      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FAF8F4] dark:bg-[#1E1D1B] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 border-b border-stone-200 dark:border-stone-800 px-5 py-4">
          <h2 id="event-form-title" className="text-lg font-bold text-stone-900 dark:text-stone-100">
            {editingEvent ? 'تعديل الحدث' : 'تسجيل حدث جديد'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق نموذج الحدث"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-200/60 dark:text-stone-400 dark:hover:bg-stone-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-7 py-5 space-y-5">
          {errors.submit && (
            <div role="alert" className="rounded-xl border border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/50 p-3 text-sm text-red-800 dark:text-red-200">
              {errors.submit}
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="ev-title" className="block text-sm font-medium text-stone-800 dark:text-stone-200">
              عنوان الحدث <span className="text-[#8C3B2B] dark:text-[#E28A6D]">*</span>
            </label>
            <input
              id="ev-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: بداية العمل الجديد، رحلة عمرة، تخرّج..."
              className="mt-1.5 w-full min-w-0 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141413] px-3.5 py-2.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-[#8C3B2B] focus:outline-none"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title}</p>
            )}
          </div>

          {/* Description (Moved directly below Title) */}
          <div>
            <label htmlFor="ev-description" className="block text-sm font-medium text-stone-800 dark:text-stone-200">
              الوصف والتفاصيل
            </label>
            <textarea
              id="ev-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="اكتب تفاصيل الحدث أو الذكرى، الأشخاص، أو ما يهمك تذكره لاحقًا..."
              className="mt-1.5 w-full min-w-0 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141413] p-3 text-sm leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-[#8C3B2B] focus:outline-none"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.description}</p>
            )}
          </div>

          {/* Date Card: Calendar Switch & Day/Month/Year in one row */}
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#141413] p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                تاريخ الحدث
              </span>
              <div className="inline-flex items-center gap-1 rounded-xl bg-stone-100 dark:bg-stone-900 p-1">
                <button
                  type="button"
                  onClick={() => handleSwitchCalendar('gregorian')}
                  className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    calendarInput === 'gregorian'
                      ? 'bg-white dark:bg-[#1E1D1B] text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  ميلادي
                </button>
                <button
                  type="button"
                  onClick={() => handleSwitchCalendar('hijri')}
                  className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    calendarInput === 'hijri'
                      ? 'bg-white dark:bg-[#1E1D1B] text-stone-900 dark:text-stone-100 shadow-xs'
                      : 'text-stone-600 dark:text-stone-400'
                  }`}
                >
                  هجري
                </button>
              </div>
            </div>

            {/* Date Inputs on the same row: اليوم، الشهر، السنة */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="min-w-0">
                <label htmlFor="ev-day" className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                  اليوم
                </label>
                <select
                  id="ev-day"
                  value={day}
                  onChange={(e) => setDay(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#1E1D1B] px-2 sm:px-3 text-xs sm:text-sm tabular-nums text-stone-900 dark:text-stone-100"
                >
                  {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="ev-month" className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                  الشهر
                </label>
                <select
                  id="ev-month"
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#1E1D1B] px-1.5 sm:px-2 text-xs sm:text-sm text-stone-900 dark:text-stone-100 truncate"
                >
                  {monthNames.map((mName, idx) => (
                    <option key={mName} value={idx + 1}>
                      {idx + 1} - {mName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-0">
                <label htmlFor="ev-year" className="block text-xs text-stone-500 dark:text-stone-400 mb-1">
                  {calendarInput === 'hijri' ? 'السنة (هـ)' : 'السنة (م)'}
                </label>
                <input
                  id="ev-year"
                  type="number"
                  min={calendarInput === 'hijri' ? 1300 : 1900}
                  max={calendarInput === 'hijri' ? 1580 : 2150}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#1E1D1B] px-2 sm:px-3 text-xs sm:text-sm tabular-nums text-stone-900 dark:text-stone-100"
                />
              </div>
            </div>

            {errors.date && (
              <p className="text-xs text-red-600 dark:text-red-400">{errors.date}</p>
            )}

            {equivalentPreview && (
              <p className="text-xs text-stone-600 dark:text-stone-400 tabular-nums break-words">
                {equivalentPreview}
              </p>
            )}
          </div>

          {/* Category & Thread Link */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="min-w-0">
              <label htmlFor="ev-category" className="block text-sm font-medium text-stone-800 dark:text-stone-200">
                التصنيف
              </label>
              <select
                id="ev-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141413] px-3 text-sm text-stone-900 dark:text-stone-100"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.categoryId}</p>
              )}
            </div>

            <div className="min-w-0">
              <label htmlFor="ev-thread" className="block text-sm font-medium text-stone-800 dark:text-stone-200">
                <span className="inline-flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
                  <span>ربط بسلسلة موضوعية (اختياري)</span>
                </span>
              </label>
              <select
                id="ev-thread"
                value={threadId}
                onChange={(e) => setThreadId(e.target.value)}
                className="mt-1.5 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141413] px-3 text-sm text-stone-900 dark:text-stone-100"
              >
                <option value="">بدون سلسلة</option>
                {threads.map((th) => (
                  <option key={th.id} value={th.id}>
                    {th.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pin */}
          <div>
            <button
              type="button"
              onClick={() => setIsPinned((v) => !v)}
              aria-pressed={isPinned}
              className={`w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer ${
                isPinned
                  ? 'border-[#8C3B2B] dark:border-[#E28A6D] bg-[#8C3B2B]/10 dark:bg-[#E28A6D]/15 text-[#8C3B2B] dark:text-[#E28A6D]'
                  : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141413] text-stone-700 dark:text-stone-300'
              }`}
            >
              <Pin className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{isPinned ? 'مثبت في الأحداث القادمة' : 'تثبيت الحدث في القادمة'}</span>
            </button>
          </div>

          {/* Phase 2: Recurrence Settings */}
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#141413] p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-stone-800 dark:text-stone-200">
              <Repeat className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
              <span>التكرار الدوري (اختياري)</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {RECURRENCE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRecurrenceFreq(opt.value)}
                  className={`min-h-[36px] rounded-lg border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                    recurrenceFreq === opt.value
                      ? 'border-[#8C3B2B] dark:border-[#E28A6D] bg-[#8C3B2B] text-white'
                      : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {recurrenceFreq !== 'none' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="min-w-0">
                  <label htmlFor="ev-rec-cal" className="block text-xs text-stone-500 dark:text-stone-400">
                    تقويم التكرار
                  </label>
                  <select
                    id="ev-rec-cal"
                    value={recurrenceCal}
                    onChange={(e) => setRecurrenceCal(e.target.value as CalendarType)}
                    className="mt-1 w-full min-h-[40px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#1E1D1B] px-3 text-xs text-stone-900 dark:text-stone-100"
                  >
                    <option value="gregorian">ميلادي</option>
                    <option value="hijri">هجري</option>
                  </select>
                </div>
                <div className="min-w-0">
                  <label htmlFor="ev-rec-end" className="block text-xs text-stone-500 dark:text-stone-400">
                    تاريخ انتهاء التكرار (اختياري)
                  </label>
                  <input
                    id="ev-rec-end"
                    type="date"
                    value={recurrenceEndDate}
                    onChange={(e) => setRecurrenceEndDate(e.target.value)}
                    className="mt-1 w-full min-h-[40px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#1E1D1B] px-3 text-xs tabular-nums text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Phase 2: Reminders */}
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#141413] p-4 space-y-3">
            <div className="flex items-center gap-1.5 text-sm font-medium text-stone-800 dark:text-stone-200">
              <Bell className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
              <span>التذكيرات والتنبيهات (اختياري)</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {REMINDER_OFFSETS.map((offset) => {
                const active = selectedReminderOffsets.includes(offset);
                return (
                  <button
                    key={offset}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleReminderOffset(offset)}
                    className={`min-h-[36px] rounded-lg border px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-[#8C3B2B] dark:border-[#E28A6D] bg-[#8C3B2B]/10 dark:bg-[#E28A6D]/15 text-[#8C3B2B] dark:text-[#E28A6D]'
                        : 'border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {REMINDER_OFFSET_LABELS[offset]}
                  </button>
                );
              })}
            </div>

            {selectedReminderOffsets.length > 0 && (
              <div className="max-w-xs">
                <label htmlFor="ev-rem-time" className="block text-xs text-stone-500 dark:text-stone-400">
                  ساعة التنبيه المفضلة (اختياري)
                </label>
                <input
                  id="ev-rem-time"
                  type="time"
                  value={reminderTime}
                  onChange={(e) => setReminderTime(e.target.value)}
                  className="mt-1 w-full min-h-[40px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#1E1D1B] px-3 text-xs tabular-nums text-stone-900 dark:text-stone-100"
                />
              </div>
            )}
          </div>



          {/* Attachments */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-stone-800 dark:text-stone-200">
                الصور والمرفقات (تُحفظ محليًا)
              </span>
              <label className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141413] px-3.5 py-2 text-xs font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer">
                <Paperclip className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
                <span>إرفاق صور أو ملفات</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,.pdf,.txt,.doc,.docx"
                  onChange={handleFilePick}
                  className="sr-only"
                />
              </label>
            </div>

            {fileError && (
              <p role="alert" className="mt-2 text-xs text-red-600 dark:text-red-400">
                {fileError}
              </p>
            )}

            {(existingAttachments.length > 0 || pendingAttachments.length > 0) && (
              <ul className="mt-3 space-y-2">
                {existingAttachments
                  .filter((att) => !removedIds.includes(att.record.id))
                  .map(({ record, previewUrl }) => (
                    <li
                      key={record.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141413] p-2.5 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt={record.name}
                            className="h-10 w-10 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <FileText className="w-5 h-5 text-stone-500 shrink-0" aria-hidden="true" />
                        )}
                        <span className="truncate font-medium text-stone-800 dark:text-stone-200">
                          {record.name}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemovedIds((prev) => [...prev, record.id])}
                        aria-label={`حذف المرفق ${record.name}`}
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}

                {pendingAttachments.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141413] p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {item.previewUrl ? (
                        <img
                          src={item.previewUrl}
                          alt={item.name}
                          className="h-10 w-10 rounded-lg object-cover shrink-0"
                        />
                      ) : (
                        <FileText className="w-5 h-5 text-stone-500 shrink-0" aria-hidden="true" />
                      )}
                      <div className="min-w-0">
                        <span className="block truncate font-medium text-stone-800 dark:text-stone-200">
                          {item.name}
                        </span>
                        {item.wasCompressed && (
                          <span className="block text-[11px] text-emerald-700 dark:text-emerald-400 tabular-nums">
                            تم ضغط الصورة تلقائيًا ({Math.max(1, Math.round((1 - item.size / item.originalSize) * 100))}% توفير)
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAttachments((prev) => prev.filter((p) => p.id !== item.id))
                      }
                      aria-label={`إزالة المرفق ${item.name}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-stone-200 dark:border-stone-800 bg-white/80 dark:bg-[#141413]/80 px-5 py-3.5 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 px-4 py-2 text-sm font-medium text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            إلغاء
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="min-h-[44px] rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-6 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'جارٍ الحفظ...' : editingEvent ? 'حفظ التعديلات' : 'حفظ الحدث'}
          </button>
        </div>
      </form>
    </div>
  );
};
