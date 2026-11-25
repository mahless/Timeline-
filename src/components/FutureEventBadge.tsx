import React from 'react';
import { Repeat, Sparkles } from 'lucide-react';
import { buildSortDateKey } from '../domain/timeline';
import type { DateParts, TimelineEvent } from '../domain/types';

interface FutureEventBadgeProps {
  event: TimelineEvent;
  today: DateParts;
  isRecurringInstance?: boolean;
}

export const FutureEventBadge: React.FC<FutureEventBadgeProps> = ({
  event,
  today,
  isRecurringInstance,
}) => {
  const todayKey = buildSortDateKey(today.year, today.month, today.day);
  const isRecurring = Boolean(event.recurrence);
  const isPreviouslyRecordedRecurring =
    isRecurring && (Boolean(isRecurringInstance) || event.sortDateKey <= todayKey);

  if (isRecurring) {
    return (
      <span className="mr-auto inline-flex items-center gap-1 rounded-lg border border-amber-500/40 dark:border-amber-400/35 bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-900 dark:text-amber-200 shrink-0">
        <Repeat className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>{isPreviouslyRecordedRecurring ? 'متكرر سابقًا' : 'متكرر'}</span>
      </span>
    );
  }

  return (
    <span className="mr-auto inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 dark:border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300 shrink-0">
      <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />
      <span>جديد</span>
    </span>
  );
};
