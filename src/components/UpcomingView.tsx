import React, { useState } from 'react';
import { Bell, BellOff, CalendarClock, Pin, Repeat } from 'lucide-react';
import { CATEGORY_COLOR_META } from '../domain/defaults';
import {
  RECURRENCE_LABELS,
  REMINDER_OFFSET_LABELS,
  type DueReminderItem,
  type UpcomingOccurrence,
} from '../domain/phase2';
import type { Category, TimelineEvent } from '../domain/types';
import {
  type NotificationPermissionState,
  getNotificationPermission,
  requestNotificationPermission,
} from '../pwa/notifications';

interface UpcomingViewProps {
  occurrences: UpcomingOccurrence[];
  dueReminders: DueReminderItem[];
  categoriesMap: Map<string, Category>;
  onSelectEvent: (event: TimelineEvent) => void;
  onTogglePin: (event: TimelineEvent) => Promise<void>;
  onDismissReminder: (key: string) => void;
}

export const UpcomingView: React.FC<UpcomingViewProps> = ({
  occurrences,
  dueReminders,
  categoriesMap,
  onSelectEvent,
  onTogglePin,
  onDismissReminder,
}) => {
  const [notifPerm, setNotifPerm] = useState<NotificationPermissionState>(() =>
    getNotificationPermission(),
  );
  const [filterMode, setFilterMode] = useState<'all' | 'pinned' | 'recurring'>('all');

  const handleRequestNotifications = async () => {
    const next = await requestNotificationPermission();
    setNotifPerm(next);
  };

  const filtered = occurrences.filter((occ) => {
    if (filterMode === 'pinned') return !!occ.event.isPinned;
    if (filterMode === 'recurring') return !!occ.event.recurrence;
    return true;
  });

  const pinnedList = filtered.filter((o) => o.event.isPinned);
  const regularList = filtered.filter((o) => !o.event.isPinned);

  const renderOccurrenceCard = (occ: UpcomingOccurrence) => {
    const cat = categoriesMap.get(occ.event.categoryId);
    const colorMeta = CATEGORY_COLOR_META[cat?.colorKey ?? 'slate'];
    const rec = occ.event.recurrence;

    return (
      <article
        key={`${occ.event.id}-${occ.occurrenceDateKey}`}
        className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-4 sm:p-5 flex flex-col gap-3"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectEvent(occ.event)}
            className="flex-1 min-w-0 text-right cursor-pointer group"
          >
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
              <span className={`inline-flex items-center gap-1 font-medium ${colorMeta.textClass}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${colorMeta.dotClass}`} aria-hidden="true" />
                {cat?.name ?? 'عام'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-medium text-stone-700 dark:text-stone-300">
                {occ.gregorianFormatted}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{occ.hijriFormatted}</span>
              {occ.event.time && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{occ.event.time}</span>
                </>
              )}
            </div>

            <h3 className="mt-1.5 text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#8C3B2B] dark:group-hover:text-[#E28A6D] break-words">
              {occ.event.title}
            </h3>
            {occ.event.description && (
              <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-2 break-words">
                {occ.event.description}
              </p>
            )}
          </button>

          <button
            type="button"
            onClick={() => onTogglePin(occ.event)}
            aria-label={occ.event.isPinned ? `إلغاء تثبيت ${occ.event.title}` : `تثبيت ${occ.event.title}`}
            aria-pressed={!!occ.event.isPinned}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border transition-colors cursor-pointer shrink-0 ${
              occ.event.isPinned
                ? 'border-[#8C3B2B] dark:border-[#E28A6D] bg-[#8C3B2B]/10 dark:bg-[#E28A6D]/15 text-[#8C3B2B] dark:text-[#E28A6D]'
                : 'border-stone-200 dark:border-stone-700 text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            <Pin className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Countdown + Recurrence + Reminders Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-stone-100 dark:border-stone-800/80 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-[#8C3B2B] dark:text-[#E28A6D] tabular-nums">
            <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>{occ.countdownLabel}</span>
          </span>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-stone-500 dark:text-stone-400">
            {rec && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  يتكرر {RECURRENCE_LABELS[rec.frequency]} ({rec.calendar === 'hijri' ? 'هجري' : 'ميلادي'})
                </span>
              </span>
            )}
            {occ.event.reminders && occ.event.reminders.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {occ.event.reminders.map((r) => REMINDER_OFFSET_LABELS[r.offset]).join(' · ')}
                </span>
              </span>
            )}
          </div>
        </div>
      </article>
    );
  };

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 [text-wrap:balance]">
            الأحداث المستقبلية والتذكيرات
          </h1>
          <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
            عداد تنازلي للمواعيد القادمة والأحداث المتكررة مع إمكانية التثبيت وضبط التنبيهات.
          </p>
        </div>

        {/* PWA Notification Permission Control */}
        <div className="shrink-0">
          {notifPerm === 'granted' ? (
            <span className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] px-3.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
              <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>إشعارات الجهاز مفعّلة</span>
            </span>
          ) : notifPerm === 'denied' ? (
            <span className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] px-3.5 text-xs font-medium text-stone-500 dark:text-stone-400">
              <BellOff className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>الإشعارات محجوبة من إعدادات المتصفح</span>
            </span>
          ) : notifPerm === 'default' ? (
            <button
              type="button"
              onClick={handleRequestNotifications}
              className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#8C3B2B] dark:border-[#E28A6D] bg-white dark:bg-[#1E1D1B] px-3.5 text-xs font-medium text-[#8C3B2B] dark:text-[#E28A6D] hover:bg-[#8C3B2B]/5 cursor-pointer"
            >
              <Bell className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>تفعيل إشعارات PWA</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-white dark:bg-[#1E1D1B] border border-stone-200/90 dark:border-stone-800 p-1.5">
        {(
          [
            { id: 'all', label: `كل القادمة (${occurrences.length})` },
            { id: 'pinned', label: 'المثبتة فقط' },
            { id: 'recurring', label: 'المتكررة فقط' },
          ] as Array<{ id: 'all' | 'pinned' | 'recurring'; label: string }>
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterMode(tab.id)}
            className={`min-h-[38px] rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
              filterMode === tab.id
                ? 'bg-[#8C3B2B] text-white'
                : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Due Reminders */}
      {dueReminders.length > 0 && (
        <div className="rounded-2xl border border-[#8C3B2B]/30 dark:border-[#E28A6D]/30 bg-white dark:bg-[#1E1D1B] p-4 space-y-2.5">
          <div>
            <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-[#8C3B2B] dark:text-[#E28A6D] shadow-2xs">
              تنبيهات مستحقة الآن
            </h2>
          </div>
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {dueReminders.map((rem) => (
              <div key={rem.key} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => onSelectEvent(rem.event)}
                  className="text-right min-w-0 flex-1 cursor-pointer"
                >
                  <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                    {rem.event.title}
                  </p>
                  {rem.event.description && (
                    <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2 break-words">
                      {rem.event.description}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    {rem.labelAr} · {rem.occurrenceDateKey}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => onDismissReminder(rem.key)}
                  className="min-h-[36px] rounded-lg border border-stone-200 dark:border-stone-700 px-3 text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                >
                  تم الاطلاع
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Occurrences List */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 text-center">
          <p className="text-base font-bold text-stone-900 dark:text-stone-100">
            لا توجد مواعيد قادمة ضمن هذه التصفية
          </p>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            أضف حدثًا مستقبليًا أو فعّل التكرار لأي مناسبة دورية لتظهر هنا مع العداد التنازلي.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pinnedList.length > 0 && (
            <div className="space-y-3">
              <div>
                <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs font-bold text-[#8C3B2B] dark:text-[#E28A6D] shadow-2xs">
                  الأحداث المثبتة ({pinnedList.length})
                </h2>
              </div>
              <div className="space-y-3">{pinnedList.map(renderOccurrenceCard)}</div>
            </div>
          )}

          {regularList.length > 0 && (
            <div className="space-y-3">
              {pinnedList.length > 0 && (
                <div>
                  <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-[#1E1D1B] text-xs font-bold text-stone-700 dark:text-stone-300 shadow-2xs">
                    بقية المواعيد القادمة ({regularList.length})
                  </h2>
                </div>
              )}
              <div className="space-y-3">{regularList.map(renderOccurrenceCard)}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
