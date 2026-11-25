import React from 'react';
import { Bell, GitBranch, MapPin, Paperclip, Pin, Repeat } from 'lucide-react';
import { CATEGORY_COLOR_META } from '../domain/defaults';
import { RECURRENCE_LABELS } from '../domain/phase2';
import {
  classifyTemporalPosition,
  formatEventGregorianDate,
  getRelativeTimeLabel,
} from '../domain/timeline';
import type { Category, DateParts, EventThread, TimelineEvent } from '../domain/types';

interface TimelineEventRowProps {
  event: TimelineEvent;
  category?: Category;
  thread?: EventThread;
  today: DateParts;
  onSelect: (event: TimelineEvent) => void;
}

export const TimelineEventRow: React.FC<TimelineEventRowProps> = ({
  event,
  category,
  thread,
  today,
  onSelect,
}) => {
  const colorMeta = CATEGORY_COLOR_META[category?.colorKey ?? 'slate'];
  const gregorianText = formatEventGregorianDate(event);
  const relativeText = getRelativeTimeLabel(event, today);
  const isFuture = classifyTemporalPosition(event, today) === 'future';

  const hasSecondary =
    Boolean(event.location) ||
    event.keywords.length > 0 ||
    event.attachmentIds.length > 0 ||
    Boolean(thread) ||
    Boolean(event.recurrence) ||
    Boolean(event.reminders && event.reminders.length > 0);

  return (
    <article className="relative pr-6 sm:pr-8 pb-5 last:pb-0 min-w-0">
      {/* Timeline Node */}
      <span
        aria-hidden="true"
        className={`absolute right-[-5px] top-5 h-2.5 w-2.5 rounded-full ring-4 ring-[#FAF8F4] dark:ring-[#141413] ${colorMeta.dotClass}`}
      />

      <button
        type="button"
        onClick={() => onSelect(event)}
        aria-label={`عرض تفاصيل الحدث: ${event.title}`}
        className={`group flex flex-col items-stretch w-full min-w-0 text-right rounded-2xl border p-4 sm:p-5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8C3B2B] cursor-pointer ${
          isFuture
            ? 'border-sky-500/35 dark:border-sky-400/30 bg-sky-500/10 dark:bg-sky-500/10 hover:border-sky-500/60 dark:hover:border-sky-400/50'
            : 'border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] hover:border-stone-300 dark:hover:border-stone-700'
        }`}
      >
        {/* Clean Unboxed Metadata Line (Zero-Pill Discipline) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
          <span className={`inline-flex items-center gap-1.5 font-medium ${colorMeta.textClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${colorMeta.dotClass}`} aria-hidden="true" />
            {category?.name ?? 'عام'}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums font-medium text-stone-700 dark:text-stone-300">
            {gregorianText}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{event.hijriFormatted}</span>
          {event.time && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{event.time}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <span className="text-stone-600 dark:text-stone-300">{relativeText}</span>
          {event.isPinned && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-medium text-[#8C3B2B] dark:text-[#E28A6D]">
                <Pin className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>مثبت</span>
              </span>
            </>
          )}
        </div>

        {/* Title */}
        <h3 className="mt-2 text-base sm:text-lg font-bold text-stone-900 dark:text-stone-100 leading-snug group-hover:text-[#8C3B2B] dark:group-hover:text-[#E28A6D] transition-colors break-words">
          {event.title}
        </h3>

        {/* Description Excerpt */}
        {event.description && (
          <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400 leading-relaxed line-clamp-2 break-words">
            {event.description}
          </p>
        )}

        {/* Secondary Metadata: Location, Thread, Recurrence, Reminders, Keywords, Attachments */}
        {hasSecondary && (
          <div
            className={`mt-3 pt-3 border-t flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500 dark:text-stone-400 ${
              isFuture
                ? 'border-sky-500/20 dark:border-sky-400/20'
                : 'border-stone-100 dark:border-stone-800/80'
            }`}
          >
            {thread && (
              <span className="inline-flex items-center gap-1 text-stone-700 dark:text-stone-300">
                <GitBranch className="w-3.5 h-3.5 shrink-0 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
                <span className="break-words">{thread.title}</span>
              </span>
            )}
            {event.recurrence && (
              <span className="inline-flex items-center gap-1">
                <Repeat className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  يتكرر {RECURRENCE_LABELS[event.recurrence.frequency]} (
                  {event.recurrence.calendar === 'hijri' ? 'هجري' : 'ميلادي'})
                </span>
              </span>
            )}
            {event.reminders && event.reminders.length > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Bell className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {event.reminders.length === 1 ? 'تذكير نشط' : `${event.reminders.length} تذكيرات`}
                </span>
              </span>
            )}
            {event.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="break-words">{event.location}</span>
              </span>
            )}
            {event.attachmentIds.length > 0 && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Paperclip className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>
                  {event.attachmentIds.length === 1
                    ? 'مرفق واحد'
                    : event.attachmentIds.length === 2
                      ? 'مرفقان'
                      : `${event.attachmentIds.length} مرفقات`}
                </span>
              </span>
            )}
            {event.keywords.length > 0 && (
              <span className="break-words max-w-full">
                {event.keywords.join(' · ')}
              </span>
            )}
          </div>
        )}
      </button>
    </article>
  );
};
