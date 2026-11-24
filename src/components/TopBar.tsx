import React from 'react';
import { Plus } from 'lucide-react';

export type ActiveView =
  | 'dashboard'
  | 'timeline'
  | 'upcoming'
  | 'threads'
  | 'stats'
  | 'gallery'
  | 'assistant'
  | 'vault'
  | 'categories';

interface TopBarProps {
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  onOpenNewEvent: () => void;
}

const NAV_ITEMS: Array<{ id: ActiveView; label: string }> = [
  { id: 'dashboard', label: 'الرئيسية' },
  { id: 'timeline', label: 'الخط الزمني' },
  { id: 'upcoming', label: 'القادمة' },
  { id: 'threads', label: 'السلاسل' },
  { id: 'stats', label: 'الإحصائيات' },
  { id: 'gallery', label: 'المعرض' },
  { id: 'assistant', label: 'المساعد' },
  { id: 'vault', label: 'الأمان والنسخ' },
];

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onChangeView,
  onOpenNewEvent,
}) => {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-[#3D312B] dark:border-stone-800 bg-[#27201D] dark:bg-[#1C1A18] text-[#FAF8F4] shadow-xs">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => onChangeView('dashboard')}
          className="text-xl sm:text-2xl font-bold tracking-tight text-[#FAF8F4] hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
        >
          ذاكرتي
        </button>

        {/* Zone 2: Primary Text Navigation Links */}
        <nav aria-label="التنقل الرئيسي" className="hidden lg:flex items-center gap-4 xl:gap-5">
          {NAV_ITEMS.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChangeView(item.id)}
                className={`relative py-1 text-xs xl:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'text-white font-semibold'
                    : 'text-stone-300 hover:text-white'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[15px] h-0.5 bg-[#E28A6D]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary CTA */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenNewEvent}
            className="min-h-[40px] flex items-center gap-1.5 rounded-xl bg-[#B8543F] hover:bg-[#A14532] px-3.5 sm:px-4 py-2 text-sm font-medium text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>حدث جديد</span>
          </button>
        </div>
      </div>
    </header>
  );
};
