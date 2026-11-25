import React from 'react';
import {
  Bell,
  CalendarPlus,
  Check,
  History,
  Pin,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { CATEGORY_COLOR_META } from '../domain/defaults';
import type {
  DashboardSummary,
  DueReminderItem,
  OnThisDayMemory,
} from '../domain/phase2';
import {
  buildSortDateKey,
  formatEventGregorianDate,
  formatTodayHeader,
} from '../domain/timeline';
import type { Category, DateParts, TimelineEvent } from '../domain/types';
import type { BackupSyncStatus } from '../pwa/autoFileBackup';
import { FutureEventBadge } from './FutureEventBadge';
import { PWAInstallButton } from './PWAInstallButton';
import type { ActiveView } from './TopBar';

interface DashboardViewProps {
  today: DateParts;
  summary: DashboardSummary;
  onThisDay: OnThisDayMemory[];
  dueReminders: DueReminderItem[];
  categoriesMap: Map<string, Category>;
  seedingSamples: boolean;
  backupSyncStatus: BackupSyncStatus;
  onSelectEvent: (event: TimelineEvent) => void;
  onDismissReminder: (key: string) => void;
  onNavigate: (view: ActiveView) => void;
  onOpenNewEvent: () => void;
  onLoadSamples: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  today,
  summary,
  onThisDay,
  dueReminders,
  categoriesMap,
  seedingSamples,
  backupSyncStatus,
  onSelectEvent,
  onDismissReminder,
  onNavigate,
  onOpenNewEvent,
  onLoadSamples,
}) => {
  const todayLabels = formatTodayHeader(today);
  const todayKey = buildSortDateKey(today.year, today.month, today.day);

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14 space-y-6">
      {/* Header Row */}
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 [text-wrap:balance]">
          لوحة الذاكرة والأحداث
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-stone-500 dark:text-stone-400 tabular-nums">
          اليوم: {todayLabels.gregorian} · {todayLabels.hijri}
        </p>
      </div>

      {/* Due Reminders Banner */}
      {dueReminders.length > 0 && (
        <div
          role="region"
          aria-label="التذكيرات المستحقة"
          className="rounded-2xl border border-[#8C3B2B]/30 dark:border-[#E28A6D]/30 bg-white dark:bg-[#1E1D1B] p-4 sm:p-5 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-[#8C3B2B] dark:text-[#E28A6D] shadow-2xs">
              <Bell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>تذكيرات نشطة ({dueReminders.length})</span>
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('upcoming')}
              className="text-xs font-medium text-stone-600 dark:text-stone-300 hover:underline cursor-pointer"
            >
              إدارة القادمة
            </button>
          </div>

          <div className="space-y-2.5">
            {dueReminders.map((rem) => {
              const isFutureRem = rem.occurrenceDateKey > todayKey;
              return (
                <div
                  key={rem.key}
                  className={`rounded-xl border px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 ${
                    isFutureRem
                      ? 'border-sky-500/35 dark:border-sky-400/30 bg-sky-500/10 dark:bg-sky-500/10'
                      : 'border-stone-200/80 dark:border-stone-800 bg-[#FAF8F4] dark:bg-[#141413]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectEvent(rem.event)}
                    className="flex-1 min-w-0 text-right cursor-pointer group"
                  >
                    <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 group-hover:text-[#8C3B2B] dark:group-hover:text-[#E28A6D] truncate">
                      {rem.event.title}
                    </p>
                    {rem.event.description && (
                      <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2 break-words">
                        {rem.event.description}
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                      {rem.labelAr} · الموعد: {rem.occurrenceDateKey}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismissReminder(rem.key)}
                    aria-label={`تجاهل تنبيه ${rem.event.title}`}
                    className={`min-h-[36px] inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer shrink-0 ${
                      isFutureRem
                        ? 'border-sky-500/30 dark:border-sky-400/30 bg-white/70 dark:bg-[#1E1D1B]/70 text-stone-700 dark:text-stone-200 hover:bg-white'
                        : 'border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>تم الاطلاع</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Backup Reminder Banner when >= 5 changes aren't exported to an external file */}
      {summary.totalCount > 0 &&
        !backupSyncStatus.linkedFileName &&
        backupSyncStatus.unsavedChangesCount >= 5 && (
          <div
            role="region"
            aria-label="تنبيه النسخ الاحتياطي"
            className="rounded-2xl border border-amber-300/80 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldAlert className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" aria-hidden="true" />
              <p className="text-xs sm:text-sm text-amber-950 dark:text-amber-100">
                لديك <span className="font-bold tabular-nums">{backupSyncStatus.unsavedChangesCount}</span> تعديلات جديدة محفوظة داخليًا لم تُصدّر إلى ملف خارجي بعد.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('vault')}
              className="min-h-[38px] rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-4 py-1.5 text-xs font-medium text-white cursor-pointer shrink-0"
            >
              النسخ الاحتياطي الآن
            </button>
          </div>
        )}

      {/* Empty State on First Visit */}
      {summary.totalCount === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 sm:p-12 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8C3B2B]/10 dark:bg-[#E28A6D]/15 text-[#8C3B2B] dark:text-[#E28A6D]">
            <CalendarPlus className="w-7 h-7" aria-hidden="true" />
          </div>
          <div className="mx-auto max-w-md space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
              أرشيفك الشخصي يبدأ هنا
            </h2>
            <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
              سجّل ذكرياتك الماضية وخططك المستقبلية مع التاريخين الميلادي والهجري، التذكيرات، التكرار، والسلاسل الموضوعية. كل شيء يُحفظ محليًا ويعمل دون إنترنت.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onOpenNewEvent}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-6 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer"
            >
              <CalendarPlus className="w-4 h-4" aria-hidden="true" />
              <span>تسجيل أول حدث</span>
            </button>
            <button
              type="button"
              disabled={seedingSamples}
              onClick={onLoadSamples}
              className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141413] px-5 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
              <span>{seedingSamples ? 'جارٍ التحميل...' : 'استكشاف بأمثلة جاهزة'}</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Summary KPI Grid (2-col, compact height, number in thin bordered circle next to title) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <div className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] px-3.5 py-2.5 sm:px-4 sm:py-3">
              <span className="text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300">
                أحداث اليوم
              </span>
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-[#8C3B2B]/5 dark:bg-[#E28A6D]/10 text-xs sm:text-sm font-bold tabular-nums text-[#8C3B2B] dark:text-[#E28A6D]">
                {summary.todayOccurrences.length}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] px-3.5 py-2.5 sm:px-4 sm:py-3">
              <span className="text-xs sm:text-sm font-medium text-stone-700 dark:text-stone-300">
                خلال هذا الأسبوع
              </span>
              <span className="flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border border-stone-300 dark:border-stone-700 bg-stone-100/80 dark:bg-stone-800/80 text-xs sm:text-sm font-bold tabular-nums text-stone-800 dark:text-stone-200">
                {summary.thisWeekCount}
              </span>
            </div>
          </div>

          {/* 2-Column Main Dashboard Body */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Column 1: ذاكرة اليوم (On This Day) + أحداث اليوم */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="inline-flex items-center gap-2 px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
                    <History className="w-3.5 h-3.5 text-[#8C3B2B] dark:text-[#E28A6D] shrink-0" aria-hidden="true" />
                    <span>ذاكرة اليوم</span>
                  </h2>
                  <span className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                    {onThisDay.length} {onThisDay.length === 1 ? 'ذكرى' : 'ذكريات'}
                  </span>
                </div>

                {onThisDay.length === 0 ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                    لا توجد ذكريات مسجلة في مثل هذا اليوم (ميلاديًا أو هجريًا) من سنوات سابقة حتى الآن.
                  </p>
                ) : (
                  <div className="divide-y divide-stone-100 dark:divide-stone-800">
                    {onThisDay.map((mem) => {
                      const cat = categoriesMap.get(mem.event.categoryId);
                      const colorMeta = CATEGORY_COLOR_META[cat?.colorKey ?? 'slate'];
                      return (
                        <button
                          key={mem.event.id}
                          type="button"
                          onClick={() => onSelectEvent(mem.event)}
                          className="w-full py-3 first:pt-0 last:pb-0 text-right flex flex-col items-stretch group cursor-pointer"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 dark:text-stone-400">
                            <span className={`font-medium ${colorMeta.textClass}`}>
                              {cat?.name ?? 'عام'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="font-semibold text-[#8C3B2B] dark:text-[#E28A6D] tabular-nums">
                              قبل {mem.yearsAgo === 1 ? 'سنة' : mem.yearsAgo === 2 ? 'سنتين' : mem.yearsAgo <= 10 ? `${mem.yearsAgo} سنوات` : `${mem.yearsAgo} سنة`}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{formatEventGregorianDate(mem.event)}</span>
                          </div>
                          <p className="mt-1 text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#8C3B2B] dark:group-hover:text-[#E28A6D] break-words">
                            {mem.event.title}
                          </p>
                          {mem.event.description && (
                            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2">
                              {mem.event.description}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Today's Agenda */}
              {summary.todayOccurrences.length > 0 && (
                <div className="rounded-2xl border border-[#8C3B2B]/25 dark:border-[#E28A6D]/25 bg-[#FAF4ED] dark:bg-[#221D1B] p-5 space-y-3 shadow-xs">
                  <div className="flex items-center">
                    <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
                      مواعيد وأحداث اليوم
                    </h2>
                  </div>
                  <div className="divide-y divide-stone-100 dark:divide-stone-800">
                    {summary.todayOccurrences.map((occ) => (
                      <button
                        key={`${occ.event.id}-${occ.occurrenceDateKey}`}
                        type="button"
                        onClick={() => onSelectEvent(occ.event)}
                        className="w-full py-2.5 first:pt-0 last:pb-0 text-right flex flex-col items-stretch group cursor-pointer"
                      >
                        <p className="text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#8C3B2B] dark:group-hover:text-[#E28A6D] break-words">
                          {occ.event.title}
                        </p>
                        {occ.event.description && (
                          <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2 break-words">
                            {occ.event.description}
                          </p>
                        )}
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                          {occ.event.time ? `الساعة ${occ.event.time} · ` : ''}
                          {occ.hijriFormatted}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: أقرب المواعيد والأحداث المثبتة */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
                    أقرب المواعيد القادمة
                  </h2>
                  <button
                    type="button"
                    onClick={() => onNavigate('upcoming')}
                    className="text-xs font-medium text-[#8C3B2B] dark:text-[#E28A6D] hover:underline cursor-pointer"
                  >
                    عرض الكل والعداد
                  </button>
                </div>

                {summary.nearestUpcoming.length === 0 ? (
                  <p className="text-sm text-stone-500 dark:text-stone-400">
                    لا توجد مواعيد قادمة خلال 30 يومًا.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {summary.nearestUpcoming.map((occ) => {
                      const cat = categoriesMap.get(occ.event.categoryId);
                      const colorMeta = CATEGORY_COLOR_META[cat?.colorKey ?? 'slate'];
                      return (
                        <button
                          key={`${occ.event.id}-${occ.occurrenceDateKey}`}
                          type="button"
                          onClick={() => onSelectEvent(occ.event)}
                          className="w-full rounded-xl border border-sky-500/35 dark:border-sky-400/30 bg-sky-500/10 dark:bg-sky-500/10 p-3.5 text-right flex flex-col items-stretch group hover:border-sky-500/60 dark:hover:border-sky-400/50 transition-colors cursor-pointer"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
                              <span className={`font-medium ${colorMeta.textClass}`}>
                                {cat?.name ?? 'عام'}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">{occ.gregorianFormatted}</span>
                              {occ.event.isPinned && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-0.5 text-[#8C3B2B] dark:text-[#E28A6D] font-medium">
                                    <Pin className="w-3 h-3" aria-hidden="true" />
                                    مثبت
                                  </span>
                                </>
                              )}
                            </span>
                            <span className="font-semibold text-[#8C3B2B] dark:text-[#E28A6D] tabular-nums">
                              {occ.countdownLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-bold text-stone-900 dark:text-stone-100 group-hover:text-[#8C3B2B] dark:group-hover:text-[#E28A6D] break-words">
                            {occ.event.title}
                          </p>
                          {occ.event.description && (
                            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2 break-words">
                              {occ.event.description}
                            </p>
                          )}
                          <div className="mt-2 flex items-center justify-end">
                            <FutureEventBadge
                              event={occ.event}
                              today={today}
                              isRecurringInstance={occ.isRecurringInstance}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* PWA Install Widget */}
              <PWAInstallButton />
            </div>
          </div>
        </>
      )}
    </section>
  );
};
