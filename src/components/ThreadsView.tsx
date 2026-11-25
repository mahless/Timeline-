import React, { useState } from 'react';
import { ArrowRight, GitBranch, Plus, Trash2 } from 'lucide-react';
import { CATEGORY_COLOR_META } from '../domain/defaults';
import {
  classifyTemporalPosition,
  compareEventsDesc,
  formatEventGregorianDate,
} from '../domain/timeline';
import type {
  Category,
  CategoryColorKey,
  DateParts,
  EventThread,
  TimelineEvent,
} from '../domain/types';
import { FutureEventBadge } from './FutureEventBadge';

interface ThreadsViewProps {
  threads: EventThread[];
  events: TimelineEvent[];
  categoriesMap: Map<string, Category>;
  today: DateParts;
  onCreateThread: (title: string, description: string, colorKey: CategoryColorKey) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
  onSelectEvent: (event: TimelineEvent) => void;
  onAddEventInThread: (threadId: string) => void;
}

const COLOR_KEYS: CategoryColorKey[] = [
  'terracotta',
  'lapis',
  'forest',
  'bronze',
  'slate',
  'plum',
];

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  threads,
  events,
  categoriesMap,
  today,
  onCreateThread,
  onDeleteThread,
  onSelectEvent,
  onAddEventInThread,
}) => {
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [colorKey, setColorKey] = useState<CategoryColorKey>('lapis');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selectedThread = threads.find((t) => t.id === selectedThreadId) ?? null;

  const getThreadEvents = (threadId: string) =>
    events
      .filter((ev) => ev.threadId === threadId)
      .sort(compareEventsDesc);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setError('يرجى إدخال عنوان السلسلة أو الموضوع.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onCreateThread(trimmed, description.trim(), colorKey);
      setTitle('');
      setDescription('');
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  if (selectedThread) {
    const linkedEvents = getThreadEvents(selectedThread.id);
    const meta = CATEGORY_COLOR_META[selectedThread.colorKey];

    return (
      <section className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14 space-y-6">
        <button
          type="button"
          onClick={() => setSelectedThreadId(null)}
          className="min-h-[40px] inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
          <span>العودة إلى جميع السلاسل</span>
        </button>

        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 sm:p-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`h-3 w-3 rounded-full shrink-0 ${meta.dotClass}`} aria-hidden="true" />
                <h1 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100 break-words">
                  {selectedThread.title}
                </h1>
              </div>
              {selectedThread.description && (
                <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
                  {selectedThread.description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onAddEventInThread(selectedThread.id)}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-4 py-2 text-xs font-medium text-white cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>إضافة حدث للسلسلة</span>
            </button>
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            إجمالي الأحداث المرتبطة: {linkedEvents.length}
          </p>
        </div>

        {linkedEvents.length === 0 ? (
          <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 text-center">
            <p className="text-sm text-stone-500 dark:text-stone-400">
              لا توجد أحداث مرتبطة بهذه السلسلة بعد. يمكنك إضافة حدث جديد أو تعديل أي حدث لربطه بها.
            </p>
          </div>
        ) : (
          <div className="border-r-2 border-stone-200 dark:border-stone-800 mr-2 sm:mr-3 space-y-4">
            {linkedEvents.map((ev) => {
              const cat = categoriesMap.get(ev.categoryId);
              const catMeta = CATEGORY_COLOR_META[cat?.colorKey ?? 'slate'];
              const isFuture = classifyTemporalPosition(ev, today) === 'future';
              return (
                <article key={ev.id} className="relative pr-6 sm:pr-8">
                  <span
                    aria-hidden="true"
                    className={`absolute right-[-5px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-[#FAF8F4] dark:ring-[#141413] ${catMeta.dotClass}`}
                  />
                  <button
                    type="button"
                    onClick={() => onSelectEvent(ev)}
                    className={`w-full flex flex-col items-stretch text-right rounded-2xl border p-4 sm:p-5 transition-colors cursor-pointer ${
                      isFuture
                        ? 'border-sky-500/35 dark:border-sky-400/30 bg-sky-500/10 dark:bg-sky-500/10 hover:border-sky-500/60 dark:hover:border-sky-400/50'
                        : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] hover:border-stone-300 dark:hover:border-stone-700'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                      <span className={`font-medium ${catMeta.textClass}`}>
                        {cat?.name ?? 'عام'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{formatEventGregorianDate(ev)}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{ev.hijriFormatted}</span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-stone-900 dark:text-stone-100 break-words">
                      {ev.title}
                    </h3>
                    {ev.description && (
                      <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                        {ev.description}
                      </p>
                    )}
                    {isFuture && (
                      <div className="mt-2 flex items-center justify-end">
                        <FutureEventBadge event={ev} today={today} />
                      </div>
                    )}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 [text-wrap:balance]">
            سلاسل الأحداث والمواضيع
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            اربط عدة أحداث متفرقة زمنيًا تحت موضوع واحد مثل المسيرة المهنية أو رحلة أو مشروع طويل الأمد.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-4 py-2 text-sm font-medium text-white cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>سلسلة جديدة</span>
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4"
        >
          <div>
            <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
              إنشاء سلسلة أحداث جديدة
            </h2>
          </div>
          <div>
            <label htmlFor="thread-title" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              عنوان السلسلة
            </label>
            <input
              id="thread-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: المسيرة المهنية، بناء المنزل، رحلة اليابان..."
              className="mt-1 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3.5 text-sm text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <label htmlFor="thread-desc" className="block text-xs font-medium text-stone-700 dark:text-stone-300">
              وصف مختصر (اختياري)
            </label>
            <input
              id="thread-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف يوضح سياق هذه المرحلة أو الموضوع..."
              className="mt-1 w-full min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3.5 text-sm text-stone-900 dark:text-stone-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">اللون:</span>
            {COLOR_KEYS.map((ck) => {
              const meta = CATEGORY_COLOR_META[ck];
              return (
                <button
                  key={ck}
                  type="button"
                  onClick={() => setColorKey(ck)}
                  className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                    colorKey === ck
                      ? 'border-stone-900 dark:border-stone-100 bg-stone-100 dark:bg-stone-800 font-medium'
                      : 'border-stone-200 dark:border-stone-800'
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} />
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[40px] rounded-xl border border-stone-300 dark:border-stone-700 px-4 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[40px] rounded-xl bg-[#8C3B2B] px-5 text-xs font-medium text-white cursor-pointer"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ السلسلة'}
            </button>
          </div>
        </form>
      )}

      {threads.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 text-center space-y-2">
          <GitBranch className="w-7 h-7 mx-auto text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
          <p className="text-base font-bold text-stone-900 dark:text-stone-100">
            لا توجد سلاسل موضوعية بعد
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            أنشئ سلسلة جديدة لتجميع الأحداث المرتبطة بموضوع واحد عبر الزمن.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {threads.map((th) => {
            const meta = CATEGORY_COLOR_META[th.colorKey];
            const count = getThreadEvents(th.id).length;
            return (
              <div
                key={th.id}
                className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 flex flex-col justify-between gap-4"
              >
                <button
                  type="button"
                  onClick={() => setSelectedThreadId(th.id)}
                  className="text-right flex flex-col items-stretch cursor-pointer group"
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${meta.dotClass}`} aria-hidden="true" />
                    <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#8C3B2B] dark:group-hover:text-[#E28A6D] break-words">
                      {th.title}
                    </h3>
                  </div>
                  {th.description && (
                    <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400 line-clamp-2">
                      {th.description}
                    </p>
                  )}
                </button>

                <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-stone-800/80 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedThreadId(th.id)}
                    className="font-medium text-[#8C3B2B] dark:text-[#E28A6D] tabular-nums hover:underline cursor-pointer"
                  >
                    {count === 0 ? 'لا توجد أحداث' : count === 1 ? 'حدث واحد' : `${count} أحداث`} · استعراض
                  </button>

                  {confirmDeleteId === th.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          await onDeleteThread(th.id);
                          setConfirmDeleteId(null);
                        }}
                        className="min-h-[32px] rounded-lg bg-red-700 px-2.5 text-xs text-white cursor-pointer"
                      >
                        تأكيد
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="min-h-[32px] rounded-lg border border-stone-300 dark:border-stone-700 px-2 text-xs cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(th.id)}
                      aria-label={`حذف سلسلة ${th.title}`}
                      className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-400 hover:text-red-700 dark:hover:text-red-400 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
