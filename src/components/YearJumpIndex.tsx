import React from 'react';
import { Compass } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface YearJumpIndexProps {
  years: Array<{ year: number; count: number }>;
  selectedYear: 'all' | number;
  totalCount: number;
  futureCount: number;
  pastCount: number;
  onSelectYear: (year: 'all' | number) => void;
  onJumpToYearAnchor: (year: number) => void;
  onJumpToToday: () => void;
}

export const YearJumpIndex: React.FC<YearJumpIndexProps> = ({
  years,
  selectedYear,
  totalCount,
  futureCount,
  pastCount,
  onSelectYear,
  onJumpToYearAnchor,
  onJumpToToday,
}) => {
  return (
    <aside className="hidden lg:block w-72 shrink-0">
      <div className="sticky top-20 space-y-5">
        {/* Archive Summary */}
        <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5">
          <h2 className="text-xs font-medium text-stone-500 dark:text-stone-400">
            فهرس الأرشيف
          </h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-[#FAF8F4] dark:bg-[#141413] p-2.5">
              <p className="text-lg font-bold tabular-nums text-stone-900 dark:text-stone-100">
                {totalCount}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">الإجمالي</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F4] dark:bg-[#141413] p-2.5">
              <p className="text-lg font-bold tabular-nums text-[#8C3B2B] dark:text-[#E28A6D]">
                {futureCount}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">قادمة</p>
            </div>
            <div className="rounded-xl bg-[#FAF8F4] dark:bg-[#141413] p-2.5">
              <p className="text-lg font-bold tabular-nums text-stone-700 dark:text-stone-300">
                {pastCount}
              </p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">ماضية</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onJumpToToday}
            className="mt-4 w-full min-h-[40px] flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-xs font-medium text-stone-800 dark:text-stone-200 hover:border-[#8C3B2B] dark:hover:border-[#E28A6D] transition-colors cursor-pointer"
          >
            <Compass className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
            <span>الانتقال إلى فاصل اليوم</span>
          </button>
        </div>

        {/* Year Navigation */}
        {years.length > 0 && (
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-3">
            <h2 className="text-xs font-medium text-stone-500 dark:text-stone-400">
              التنقل حسب السنة
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelectYear('all')}
                className={`min-h-[38px] rounded-xl px-3.5 text-xs font-medium cursor-pointer ${
                  selectedYear === 'all'
                    ? 'bg-[#8C3B2B] text-white'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                }`}
              >
                الكل
              </button>
              <div className="flex-1 min-w-0">
                <select
                  aria-label="اختر السنة"
                  value={selectedYear}
                  onChange={(e) => {
                    const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                    onSelectYear(val);
                    if (val !== 'all') {
                      onJumpToYearAnchor(val);
                    }
                  }}
                  className="w-full min-h-[38px] rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-xs font-medium text-stone-800 dark:text-stone-100 cursor-pointer"
                >
                  <option value="all">اختر السنة...</option>
                  {years.map((y) => (
                    <option key={y.year} value={y.year}>
                      {y.year} ({y.count})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* PWA Install */}
        <div>
          <PWAInstallButton />
        </div>
      </div>
    </aside>
  );
};
