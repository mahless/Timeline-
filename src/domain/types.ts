export type DatePrecision = 'exact' | 'month' | 'year';

export type CalendarType = 'gregorian' | 'hijri';

export type TemporalPosition = 'past' | 'today' | 'future';

export type CategoryColorKey =
  | 'terracotta'
  | 'lapis'
  | 'forest'
  | 'bronze'
  | 'slate'
  | 'plum';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface RecurrenceRule {
  frequency: RecurrenceFrequency;
  calendar: CalendarType;
  endDate?: string; // YYYY-MM-DD optional
}

export type ReminderOffset = 'same_day' | 'day_before' | 'week_before' | 'month_before';

export interface ReminderRule {
  id: string;
  offset: ReminderOffset;
  time?: string; // HH:mm optional
}

export interface EventThread {
  id: string;
  title: string;
  description?: string;
  colorKey: CategoryColorKey;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  colorKey: CategoryColorKey;
  isDefault: boolean;
  order: number;
  createdAt: string;
}

export interface AttachmentMeta {
  id: string;
  eventId: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface AttachmentRecord extends AttachmentMeta {
  blob: Blob;
}

export interface TimelineEvent {
  id: string;
  title: string;
  datePrecision: DatePrecision;
  calendarInput: CalendarType;
  gregorianYear: number;
  gregorianMonth?: number;
  gregorianDay?: number;
  sortDateKey: string; // YYYY-MM-DD for deterministic sorting
  hijriYear: number;
  hijriMonth?: number;
  hijriDay?: number;
  hijriFormatted: string;
  time?: string; // HH:mm
  categoryId: string;
  description: string;
  location?: string;
  keywords: string[];
  attachmentIds: string[];
  isPinned?: boolean;
  threadId?: string;
  recurrence?: RecurrenceRule;
  reminders?: ReminderRule[];
  createdAt: string;
  updatedAt: string;
}

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface EventFormInput {
  title: string;
  datePrecision: DatePrecision;
  calendarInput: CalendarType;
  year: number;
  month?: number;
  day?: number;
  time?: string;
  categoryId: string;
  description: string;
  location?: string;
  keywords: string[];
  isPinned?: boolean;
  threadId?: string;
  recurrence?: RecurrenceRule;
  reminders?: ReminderRule[];
}

export interface TimelineFilters {
  temporal: 'all' | TemporalPosition;
  categoryId: 'all' | string;
  year: 'all' | number;
  searchQuery: string;
}

export interface MonthGroup {
  month: number | null; // null when datePrecision === 'year'
  label: string;
  events: TimelineEvent[];
}

export interface YearGroup {
  year: number;
  months: MonthGroup[];
  totalCount: number;
}

export interface TimelineHorizonResult {
  futureYears: YearGroup[];
  todayEvents: TimelineEvent[];
  pastYears: YearGroup[];
}
