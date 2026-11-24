import React, { useState } from 'react';
import {
  BarChart3,
  CalendarClock,
  CalendarDays,
  FolderKanban,
  GitBranch,
  Images,
  LayoutDashboard,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import type { ActiveView } from './TopBar';

interface MobileBottomBarProps {
  activeView: ActiveView;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onChangeView: (view: ActiveView) => void;
}

const PRIMARY_TABS: Array<{
  id: ActiveView;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'الرئيسية', icon: LayoutDashboard },
  { id: 'timeline', label: 'الزمني', icon: CalendarDays },
  { id: 'upcoming', label: 'القادمة', icon: CalendarClock },
  { id: 'assistant', label: 'المساعد', icon: Sparkles },
];

const MORE_ITEMS: Array<{
  id: ActiveView;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'threads', label: 'السلاسل الموضوعية', icon: GitBranch },
  { id: 'stats', label: 'الإحصائيات والتقارير', icon: BarChart3 },
  { id: 'gallery', label: 'معرض الذكريات والمرفقات', icon: Images },
  { id: 'vault', label: 'الأمان والنسخ الاحتياطي', icon: ShieldCheck },
  { id: 'categories', label: 'إدارة التصنيفات', icon: FolderKanban },
];

export const MobileBottomBar: React.FC<MobileBottomBarProps> = ({
  activeView,
  theme,
  onToggleTheme,
  onChangeView,
}) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const isMoreActive = MORE_ITEMS.some((item) => item.id === activeView);

  const handleSelect = (view: ActiveView) => {
    setMoreOpen(false);
    onChangeView(view);
  };

  return (
    <>
      {moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 flex items-end bg-black/40 backdrop-blur-xs"
          onClick={() => setMoreOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="المزيد من الأقسام"
        >
          <div
            className="w-full rounded-t-3xl border-t border-stone-200 dark:border-stone-800 bg-[#FAF8F4] dark:bg-[#1E1D1B] p-4 pb-20 space-y-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="text-sm font-bold text-stone-900 dark:text-stone-100">
                أقسام الأرشيف والأدوات
              </span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="إغلاق القائمة"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-200/60 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`min-h-[48px] flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'border-[#8C3B2B] dark:border-[#E28A6D] bg-[#8C3B2B]/10 dark:bg-[#E28A6D]/15 text-[#8C3B2B] dark:text-[#E28A6D]'
                        : 'border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141413] text-stone-800 dark:text-stone-200'
                    }`}
                  >
                    <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={onToggleTheme}
                className="min-h-[48px] flex items-center gap-3 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#141413] px-4 py-2.5 text-sm font-medium text-stone-800 dark:text-stone-200 transition-colors cursor-pointer"
              >
                {theme === 'light' ? (
                  <>
                    <Moon className="w-5 h-5 shrink-0 text-[#8C3B2B]" aria-hidden="true" />
                    <span>تفعيل الوضع الليلي</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-5 h-5 shrink-0 text-[#E28A6D]" aria-hidden="true" />
                    <span>تفعيل الوضع الفاتح</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="التنقل السفلي للهاتف"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-14 border-t border-stone-200/90 dark:border-stone-800/90 bg-[#FAF8F4]/95 dark:bg-[#141413]/95 backdrop-blur-md"
      >
        <div className="grid h-full grid-cols-5 items-center">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleSelect(tab.id)}
                className={`flex h-full min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors cursor-pointer ${
                  isActive
                    ? 'text-[#8C3B2B] dark:text-[#E28A6D]'
                    : 'text-stone-500 dark:text-stone-400'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span className="truncate max-w-full">{tab.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className={`flex h-full min-h-[44px] min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-medium transition-colors cursor-pointer ${
              isMoreActive || moreOpen
                ? 'text-[#8C3B2B] dark:text-[#E28A6D]'
                : 'text-stone-500 dark:text-stone-400'
            }`}
          >
            <Menu className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="truncate max-w-full">المزيد</span>
          </button>
        </div>
      </nav>
    </>
  );
};
