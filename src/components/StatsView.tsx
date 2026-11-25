import React from 'react';
import { CATEGORY_COLOR_META } from '../domain/defaults';
import type { ArchiveStatistics } from '../domain/phase2';
import { PWAInstallButton } from './PWAInstallButton';

interface StatsViewProps {
  stats: ArchiveStatistics;
  totalEvents: number;
}

export const StatsView: React.FC<StatsViewProps> = ({
  stats,
  totalEvents,
}) => {
  const maxYearCount = Math.max(1, ...stats.byYear.map((y) => y.count));
  const maxMonthCount = Math.max(1, ...stats.byMonthActivity.map((m) => m.count));

  return (
    <section className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 [text-wrap:balance]">
          إحصائيات وتقارير الأرشيف
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          تحليل زمني لأحداثك المسجلة حسب السنوات والأشهر والتصنيفات.
        </p>
      </div>

      {/* Key Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-4 sm:p-5">
          <p className="text-xs text-stone-500 dark:text-stone-400">السنة الأكثر نشاطًا</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {stats.mostActiveYear ? stats.mostActiveYear.year : '—'}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            {stats.mostActiveYear ? `${stats.mostActiveYear.count} أحداث` : 'لا توجد بيانات'}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-4 sm:p-5">
          <p className="text-xs text-stone-500 dark:text-stone-400">الشهر الأكثر نشاطًا</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
            {stats.mostActiveMonth ? stats.mostActiveMonth.name : '—'}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            {stats.mostActiveMonth ? `${stats.mostActiveMonth.count} أحداث` : 'لا توجد بيانات'}
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-4 sm:p-5">
          <p className="text-xs text-stone-500 dark:text-stone-400">الأحداث المتكررة</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {stats.recurringCount}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 tabular-nums">
            {stats.pinnedCount} مثبتة في القادمة
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-4 sm:p-5">
          <p className="text-xs text-stone-500 dark:text-stone-400">إجمالي المرفقات</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {stats.attachmentsTotalCount}
          </p>
          <p className="mt-1 text-xs text-stone-500 dark:text-stone-400">
            محفوظة محليًا
          </p>
        </div>
      </div>

      {totalEvents === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 text-center">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            أضف أحداثًا لعرض الرسوم والتقارير الزمنية هنا.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribution by Year */}
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
            <div>
              <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
                الأحداث حسب السنة
              </h2>
            </div>
            <div className="space-y-3">
              {stats.byYear.map((item) => {
                const widthPct = Math.max(8, Math.round((item.count / maxYearCount) * 100));
                return (
                  <div key={item.year} className="space-y-1">
                    <div className="flex items-center justify-between text-xs tabular-nums">
                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                        {item.year}
                      </span>
                      <span className="text-stone-500 dark:text-stone-400">{item.count}</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#8C3B2B] dark:bg-[#E28A6D]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Distribution by Category */}
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
            <div>
              <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
                الأحداث حسب التصنيف
              </h2>
            </div>
            <div className="space-y-3">
              {stats.byCategory.map((item) => {
                const meta = CATEGORY_COLOR_META[item.colorKey];
                return (
                  <div key={item.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="inline-flex items-center gap-1.5 font-medium text-stone-800 dark:text-stone-200">
                        <span className={`h-2 w-2 rounded-full ${meta.dotClass}`} aria-hidden="true" />
                        <span>{item.name}</span>
                      </span>
                      <span className="tabular-nums text-stone-500 dark:text-stone-400">
                        {item.count} ({item.percentage}%)
                      </span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.max(item.count > 0 ? 6 : 0, item.percentage)}%`,
                          backgroundColor: meta.swatchBg,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly Activity Report (Responsive Grid — Zero Horizontal Scroll) */}
          <div className="lg:col-span-2 rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
            <div>
              <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
                توزيع النشاط عبر أشهر السنة
              </h2>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-12 gap-2.5 items-end">
              {stats.byMonthActivity.map((m) => {
                const heightPct = m.count > 0 ? Math.max(16, Math.round((m.count / maxMonthCount) * 100)) : 6;
                return (
                  <div key={m.month} className="flex flex-col items-center gap-1.5">
                    <span className="text-[11px] font-medium tabular-nums text-stone-600 dark:text-stone-300">
                      {m.count}
                    </span>
                    <div className="h-20 w-full max-w-[32px] rounded-lg bg-stone-100 dark:bg-stone-800 flex items-end overflow-hidden p-0.5">
                      <div
                        className={`w-full rounded-md ${
                          m.count > 0
                            ? 'bg-[#8C3B2B] dark:bg-[#E28A6D]'
                            : 'bg-stone-200 dark:bg-stone-700'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-stone-500 dark:text-stone-400 truncate max-w-full">
                      {m.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-sm">
        <PWAInstallButton />
      </div>
    </section>
  );
};
