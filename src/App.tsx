import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarPlus,
  Compass,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import { AssistantView } from './components/AssistantView';
import { CategoriesView } from './components/CategoriesView';
import { DashboardView } from './components/DashboardView';
import { EventDetailModal } from './components/EventDetailModal';
import { EventFormModal } from './components/EventFormModal';
import { GalleryView } from './components/GalleryView';
import { MobileBottomBar } from './components/MobileBottomBar';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PinLockScreen } from './components/PinLockScreen';
import { StatsView } from './components/StatsView';
import { ThreadsView } from './components/ThreadsView';
import { TimelineEventRow } from './components/TimelineEventRow';
import { type ActiveView, TopBar } from './components/TopBar';
import { UpcomingView } from './components/UpcomingView';
import { VaultView } from './components/VaultView';
import { YearJumpIndex } from './components/YearJumpIndex';
import type { PinHashRecord } from './domain/cryptoVault';
import {
  computeArchiveStatistics,
  computeDashboardSummary,
  getDueReminders,
  getOnThisDayMemories,
  getUpcomingOccurrences,
} from './domain/phase2';
import {
  buildTimelineEvent,
  classifyTemporalPosition,
  extractQuickYears,
  filterEvents,
  formatTodayHeader,
  getTodayParts,
  groupTimelineByHorizon,
} from './domain/timeline';
import type {
  AttachmentRecord,
  Category,
  CategoryColorKey,
  EventFormInput,
  EventThread,
  TemporalPosition,
  TimelineEvent,
  TimelineFilters,
  YearGroup,
} from './domain/types';
import {
  DEFAULT_BACKUP_SYNC_STATUS,
  getBackupSyncStatus,
  syncAutoBackupOnChange,
  type BackupSyncStatus,
} from './pwa/autoFileBackup';
import { dispatchBrowserNotification } from './pwa/notifications';
import {
  deleteCategoryAndReassign,
  deleteEventAndAttachments,
  deleteThreadAndUnlink,
  exportFullBackup,
  generateId,
  getMetaValue,
  initializeArchive,
  saveCategory,
  saveEventWithAttachments,
  saveThread,
  seedSampleArchive,
  setMetaValue,
} from './storage/db';

const INITIAL_FILTERS: TimelineFilters = {
  temporal: 'all',
  categoryId: 'all',
  year: 'all',
  searchQuery: '',
};

export default function App() {
  const today = useMemo(() => getTodayParts(), []);
  const todayLabels = useMemo(() => formatTodayHeader(today), [today]);

  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [threads, setThreads] = useState<EventThread[]>([]);
  const [dismissedReminderKeys, setDismissedReminderKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [filters, setFilters] = useState<TimelineFilters>(INITIAL_FILTERS);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontScale, setFontScale] = useState<'normal' | 'large'>('normal');
  const [pinRecord, setPinRecord] = useState<PinHashRecord | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [backupSyncStatus, setBackupSyncStatus] = useState<BackupSyncStatus>(
    DEFAULT_BACKUP_SYNC_STATUS,
  );

  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [defaultThreadId, setDefaultThreadId] = useState<string | undefined>(undefined);
  const [seedingSamples, setSeedingSamples] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<any | null>(null);

  const notifiedSessionKeysRef = useRef<Set<string>>(new Set());

  const handleNavigateView = useCallback(
    (view: ActiveView) => {
      if (view === activeView) return;
      if (lightboxItem) setLightboxItem(null);
      if (formOpen) setFormOpen(false);
      if (selectedEvent) setSelectedEvent(null);

      if (view !== 'dashboard' && activeView === 'dashboard') {
        window.history.pushState({ view }, '');
      } else if (view === 'dashboard' && activeView !== 'dashboard') {
        window.history.back();
        return;
      } else {
        window.history.pushState({ view }, '');
      }
      setActiveView(view);
    },
    [activeView, lightboxItem, formOpen, selectedEvent],
  );

  useEffect(() => {
    const handlePopState = () => {
      if (formOpen) {
        setFormOpen(false);
        setEditingEvent(null);
        setDefaultThreadId(undefined);
        return;
      }
      if (selectedEvent) {
        setSelectedEvent(null);
        return;
      }
      if (lightboxItem) {
        setLightboxItem(null);
        return;
      }
      if (activeView !== 'dashboard') {
        setActiveView('dashboard');
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [formOpen, selectedEvent, lightboxItem, activeView]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [archive, savedTheme, savedDismissed, savedFontScale, savedPin, savedSync] =
        await Promise.all([
          initializeArchive(),
          getMetaValue<'light' | 'dark'>('theme'),
          getMetaValue<string[]>('dismissedReminders'),
          getMetaValue<'normal' | 'large'>('fontScale'),
          getMetaValue<PinHashRecord | null>('pinHash'),
          getBackupSyncStatus(),
        ]);
      setEvents(archive.events);
      setCategories(archive.categories);
      setThreads(archive.threads);
      setBackupSyncStatus(savedSync);
      if (Array.isArray(savedDismissed)) {
        setDismissedReminderKeys(savedDismissed);
      }
      if (savedTheme === 'dark' || savedTheme === 'light') {
        setTheme(savedTheme);
        document.documentElement.classList.toggle('dark', savedTheme === 'dark');
      }
      const nextFontScale = savedFontScale === 'large' ? 'large' : 'normal';
      setFontScale(nextFontScale);
      document.documentElement.dataset.fontScale = nextFontScale;

      if (savedPin && savedPin.hashBase64 && savedPin.saltBase64) {
        setPinRecord(savedPin);
        setIsLocked(true);
      } else {
        setPinRecord(null);
        setIsLocked(false);
      }
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'تعذر قراءة الأرشيف المحلي من المتصفح.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleTheme = async () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    try {
      await setMetaValue('theme', nextTheme);
    } catch {
      // Non-blocking preference save
    }
  };

  const handleChangeFontScale = async (nextScale: 'normal' | 'large') => {
    setFontScale(nextScale);
    document.documentElement.dataset.fontScale = nextScale;
    try {
      await setMetaValue('fontScale', nextScale);
    } catch {
      // Non-blocking preference save
    }
  };

  const handleSetPin = async (record: PinHashRecord | null) => {
    await setMetaValue('pinHash', record);
    setPinRecord(record);
    if (!record) {
      setIsLocked(false);
    }
  };

  const handleLockNow = () => {
    if (pinRecord) {
      setSelectedEvent(null);
      setFormOpen(false);
      setIsLocked(true);
    }
  };

  const refreshAutoBackup = useCallback(() => {
    syncAutoBackupOnChange(exportFullBackup)
      .then(setBackupSyncStatus)
      .catch(() => {});
  }, []);

  const handleRestoreComplete = (next: {
    events: TimelineEvent[];
    categories: Category[];
    threads: EventThread[];
  }) => {
    setEvents(next.events);
    setCategories(next.categories);
    setThreads(next.threads);
    getBackupSyncStatus().then(setBackupSyncStatus).catch(() => {});
  };

  const categoriesMap = useMemo(
    () => new Map<string, Category>(categories.map((c) => [c.id, c])),
    [categories],
  );

  const threadsMap = useMemo(
    () => new Map<string, EventThread>(threads.map((t) => [t.id, t])),
    [threads],
  );

  const dismissedSet = useMemo(
    () => new Set<string>(dismissedReminderKeys),
    [dismissedReminderKeys],
  );

  const filteredEvents = useMemo(
    () => filterEvents(events, categoriesMap, filters, today, threadsMap),
    [events, categoriesMap, filters, today, threadsMap],
  );

  const horizon = useMemo(
    () => groupTimelineByHorizon(filteredEvents, today),
    [filteredEvents, today],
  );

  const quickYears = useMemo(() => extractQuickYears(events), [events]);

  const archiveCounts = useMemo(() => {
    let future = 0;
    let past = 0;
    for (const ev of events) {
      const pos = classifyTemporalPosition(ev, today);
      if (pos === 'future') future++;
      else if (pos === 'past') past++;
    }
    return { total: events.length, future, past };
  }, [events, today]);

  // Phase 2 computations
  const dashboardSummary = useMemo(
    () => computeDashboardSummary(events, today),
    [events, today],
  );

  const onThisDayMemories = useMemo(
    () => getOnThisDayMemories(events, today),
    [events, today],
  );

  const upcomingOccurrences = useMemo(
    () => getUpcomingOccurrences(events, today),
    [events, today],
  );

  const dueReminders = useMemo(
    () => getDueReminders(events, today, dismissedSet),
    [events, today, dismissedSet],
  );

  const archiveStats = useMemo(
    () => computeArchiveStatistics(events, categories),
    [events, categories],
  );

  // Dispatch PWA notifications once per session for active due reminders
  useEffect(() => {
    if (loading || dueReminders.length === 0) return;
    for (const rem of dueReminders) {
      if (notifiedSessionKeysRef.current.has(rem.key)) continue;
      notifiedSessionKeysRef.current.add(rem.key);
      dispatchBrowserNotification(
        `تذكير: ${rem.event.title}`,
        `${rem.labelAr} · الموعد: ${rem.occurrenceDateKey}`,
        rem.key,
      );
    }
  }, [loading, dueReminders]);

  const hasActiveFilters =
    filters.temporal !== 'all' ||
    filters.categoryId !== 'all' ||
    filters.year !== 'all' ||
    filters.searchQuery.trim().length > 0;

  const handleSelectEvent = (event: TimelineEvent | null) => {
    if (event) {
      window.history.pushState({ modal: 'detail' }, '');
      setSelectedEvent(event);
    } else {
      setSelectedEvent(null);
    }
  };

  const handleOpenNewEvent = () => {
    window.history.pushState({ modal: 'form' }, '');
    setEditingEvent(null);
    setDefaultThreadId(undefined);
    setFormOpen(true);
  };

  const handleOpenNewEventInThread = (threadId: string) => {
    window.history.pushState({ modal: 'form' }, '');
    setEditingEvent(null);
    setDefaultThreadId(threadId);
    setFormOpen(true);
  };

  const handleOpenEditEvent = (event: TimelineEvent) => {
    window.history.pushState({ modal: 'form' }, '');
    setSelectedEvent(null);
    setDefaultThreadId(undefined);
    setEditingEvent(event);
    setFormOpen(true);
  };

  const handleSaveEvent = async (
    input: EventFormInput,
    options: {
      existingEvent?: TimelineEvent;
      newAttachments: AttachmentRecord[];
      removedAttachmentIds: string[];
      keptAttachmentIds: string[];
    },
  ) => {
    const id = options.existingEvent?.id ?? generateId();
    const attachmentIds = [
      ...options.keptAttachmentIds,
      ...options.newAttachments.map((a) => a.id),
    ];

    const built = buildTimelineEvent(input, id, attachmentIds, options.existingEvent);
    await saveEventWithAttachments(
      built,
      options.newAttachments,
      options.removedAttachmentIds,
    );

    setEvents((prev) => {
      const exists = prev.some((item) => item.id === built.id);
      if (exists) {
        return prev.map((item) => (item.id === built.id ? built : item));
      }
      return [built, ...prev];
    });

    setFormOpen(false);
    setEditingEvent(null);
    setDefaultThreadId(undefined);
    refreshAutoBackup();
    window.history.back();
    if (activeView === 'categories' || activeView === 'stats') {
      setActiveView('timeline');
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    await deleteEventAndAttachments(eventId);
    setEvents((prev) => prev.filter((item) => item.id !== eventId));
    setSelectedEvent(null);
    refreshAutoBackup();
    window.history.back();
  };

  const handleTogglePin = async (event: TimelineEvent) => {
    const updated: TimelineEvent = {
      ...event,
      isPinned: !event.isPinned,
      updatedAt: new Date().toISOString(),
    };
    await saveEventWithAttachments(updated, [], []);
    setEvents((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelectedEvent((prev) => (prev && prev.id === updated.id ? updated : prev));
    refreshAutoBackup();
  };

  const handleDismissReminder = async (key: string) => {
    if (dismissedSet.has(key)) return;
    const next = [...dismissedReminderKeys, key];
    setDismissedReminderKeys(next);
    try {
      await setMetaValue('dismissedReminders', next);
    } catch {
      // Non-blocking
    }
  };

  const handleCreateThread = async (
    title: string,
    description: string,
    colorKey: CategoryColorKey,
  ) => {
    const now = new Date().toISOString();
    const thread: EventThread = {
      id: generateId(),
      title,
      description: description || undefined,
      colorKey,
      createdAt: now,
      updatedAt: now,
    };
    await saveThread(thread);
    setThreads((prev) => [thread, ...prev]);
    refreshAutoBackup();
  };

  const handleDeleteThread = async (threadId: string) => {
    const updatedEvents = await deleteThreadAndUnlink(threadId);
    const updatedMap = new Map(updatedEvents.map((e) => [e.id, e]));
    setEvents((prev) => prev.map((e) => updatedMap.get(e.id) ?? e));
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    refreshAutoBackup();
  };

  const handleAddCategory = async (name: string, colorKey: CategoryColorKey) => {
    const nextOrder =
      categories.length > 0 ? Math.max(...categories.map((c) => c.order)) + 1 : 1;
    const category: Category = {
      id: generateId(),
      name,
      colorKey,
      isDefault: false,
      order: nextOrder,
      createdAt: new Date().toISOString(),
    };
    await saveCategory(category);
    setCategories((prev) => [...prev, category]);
    refreshAutoBackup();
  };

  const handleUpdateCategory = async (category: Category) => {
    await saveCategory(category);
    setCategories((prev) => prev.map((c) => (c.id === category.id ? category : c)));
    refreshAutoBackup();
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const fallback = categories.find((c) => c.id !== categoryId);
    if (!fallback) return;
    const updatedEvents = await deleteCategoryAndReassign(categoryId, fallback.id);
    const updatedMap = new Map(updatedEvents.map((e) => [e.id, e]));
    setEvents((prev) => prev.map((e) => updatedMap.get(e.id) ?? e));
    setCategories((prev) => prev.filter((c) => c.id !== categoryId));
    if (filters.categoryId === categoryId) {
      setFilters((prev) => ({ ...prev, categoryId: 'all' }));
    }
    refreshAutoBackup();
  };

  const handleLoadSamples = async () => {
    setSeedingSamples(true);
    try {
      const seeded = await seedSampleArchive();
      setEvents(seeded.events);
      setThreads(seeded.threads);
      refreshAutoBackup();
    } finally {
      setSeedingSamples(false);
    }
  };

  const scrollToElementId = (elementId: string) => {
    requestAnimationFrame(() => {
      const el = document.getElementById(elementId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const renderYearGroups = (groups: YearGroup[], sectionPrefix: string) =>
    groups.map((yearGroup) => (
      <section
        key={`${sectionPrefix}-${yearGroup.year}`}
        id={`year-${yearGroup.year}`}
        className="scroll-mt-20 space-y-5 min-w-0"
      >
        <div className="flex items-baseline justify-between border-b border-stone-200/80 dark:border-stone-800 pb-2">
          <h2 className="text-2xl sm:text-3xl font-bold tabular-nums text-stone-900 dark:text-stone-100">
            {yearGroup.year}
          </h2>
          <span className="text-xs tabular-nums text-stone-500 dark:text-stone-400">
            {yearGroup.totalCount === 1
              ? 'حدث واحد'
              : yearGroup.totalCount === 2
                ? 'حدثان'
                : `${yearGroup.totalCount} أحداث`}
          </span>
        </div>

        <div className="space-y-6">
          {yearGroup.months.map((monthGroup) => (
            <div key={`${yearGroup.year}-${monthGroup.month ?? 'approx'}`} className="space-y-3 min-w-0">
              <h3 className="text-xs font-semibold tracking-wide text-stone-500 dark:text-stone-400 pr-2">
                {monthGroup.label}
              </h3>
              <div className="border-r-2 border-stone-200 dark:border-stone-800 mr-2 sm:mr-3">
                {monthGroup.events.map((ev) => (
                  <TimelineEventRow
                    key={ev.id}
                    event={ev}
                    category={categoriesMap.get(ev.categoryId)}
                    thread={ev.threadId ? threadsMap.get(ev.threadId) : undefined}
                    today={today}
                    onSelect={handleSelectEvent}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    ));

  if (!loading && pinRecord && isLocked) {
    return (
      <PinLockScreen
        pinRecord={pinRecord}
        onUnlock={() => setIsLocked(false)}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F4] dark:bg-[#141413] text-stone-900 dark:text-stone-100 overflow-x-clip">
      <TopBar
        activeView={activeView}
        onChangeView={handleNavigateView}
        onOpenNewEvent={handleOpenNewEvent}
      />

      <main className="flex-1 min-w-0">
        {loading ? (
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 space-y-4">
            <div className="h-8 w-48 rounded-xl bg-stone-200/70 dark:bg-stone-800 animate-pulse" />
            <div className="h-28 w-full rounded-2xl bg-stone-200/60 dark:bg-stone-800/70 animate-pulse" />
            <div className="h-28 w-full rounded-2xl bg-stone-200/60 dark:bg-stone-800/70 animate-pulse" />
          </div>
        ) : loadError ? (
          <div className="mx-auto max-w-xl px-4 py-16 text-center space-y-4">
            <p role="alert" className="text-base font-medium text-red-700 dark:text-red-400">
              {loadError}
            </p>
            <button
              type="button"
              onClick={loadData}
              className="min-h-[44px] rounded-xl bg-[#8C3B2B] px-5 py-2 text-sm font-medium text-white cursor-pointer"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : activeView === 'dashboard' ? (
          <DashboardView
            today={today}
            summary={dashboardSummary}
            onThisDay={onThisDayMemories}
            dueReminders={dueReminders}
            categoriesMap={categoriesMap}
            seedingSamples={seedingSamples}
            backupSyncStatus={backupSyncStatus}
            onSelectEvent={handleSelectEvent}
            onDismissReminder={handleDismissReminder}
            onNavigate={handleNavigateView}
            onOpenNewEvent={handleOpenNewEvent}
            onLoadSamples={handleLoadSamples}
          />
        ) : activeView === 'upcoming' ? (
          <UpcomingView
            today={today}
            occurrences={upcomingOccurrences}
            dueReminders={dueReminders}
            categoriesMap={categoriesMap}
            onSelectEvent={handleSelectEvent}
            onTogglePin={handleTogglePin}
            onDismissReminder={handleDismissReminder}
          />
        ) : activeView === 'threads' ? (
          <ThreadsView
            threads={threads}
            events={events}
            categoriesMap={categoriesMap}
            today={today}
            onCreateThread={handleCreateThread}
            onDeleteThread={handleDeleteThread}
            onSelectEvent={handleSelectEvent}
            onAddEventInThread={handleOpenNewEventInThread}
          />
        ) : activeView === 'stats' ? (
          <StatsView
            stats={archiveStats}
            totalEvents={events.length}
          />
        ) : activeView === 'gallery' ? (
          <GalleryView
            events={events}
            categories={categories}
            today={today}
            lightboxItem={lightboxItem}
            setLightboxItem={(item) => {
              if (item) {
                window.history.pushState({ modal: 'lightbox' }, '');
              }
              setLightboxItem(item);
            }}
            onSelectEvent={handleSelectEvent}
          />
        ) : activeView === 'assistant' ? (
          <AssistantView
            events={events}
            categoriesMap={categoriesMap}
            threadsMap={threadsMap}
            today={today}
            onSelectEvent={handleSelectEvent}
          />
        ) : activeView === 'vault' ? (
          <VaultView
            events={events}
            categories={categories}
            threads={threads}
            categoriesMap={categoriesMap}
            threadsMap={threadsMap}
            today={today}
            theme={theme}
            fontScale={fontScale}
            pinConfigured={Boolean(pinRecord)}
            backupSyncStatus={backupSyncStatus}
            onBackupSyncStatusChange={setBackupSyncStatus}
            onToggleTheme={handleToggleTheme}
            onChangeFontScale={handleChangeFontScale}
            onOpenCategories={() => handleNavigateView('categories')}
            onSetPin={handleSetPin}
            onLockNow={handleLockNow}
            onRestoreComplete={handleRestoreComplete}
          />
        ) : activeView === 'categories' ? (
          <CategoriesView
            categories={categories}
            events={events}
            theme={theme}
            onToggleTheme={handleToggleTheme}
            onAddCategory={handleAddCategory}
            onUpdateCategory={handleUpdateCategory}
            onDeleteCategory={handleDeleteCategory}
          />
        ) : (
          <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14">
            <div className="flex flex-col lg:flex-row gap-8 items-stretch">
              {/* Main Timeline Column */}
              <div className="w-full flex-1 min-w-0 space-y-6">
                {/* Header */}
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 [text-wrap:balance]">
                    الأرشيف الزمني ({events.length} حدث)
                  </h1>
                  <p className="mt-1 text-xs sm:text-sm text-stone-500 dark:text-stone-400 tabular-nums">
                    اليوم: {todayLabels.gregorian} · {todayLabels.hijri}
                  </p>
                </div>

                {/* Search Input */}
                <div className="relative min-w-0">
                  <Search
                    className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={filters.searchQuery}
                    onChange={(e) =>
                      setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))
                    }
                    aria-label="البحث في الأحداث والذكريات"
                    placeholder="ابحث بالعنوان، الوصف، التاريخ، الموقع، أو الكلمات المفتاحية..."
                    className="w-full min-w-0 min-h-[44px] rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1D1B] pr-10 pl-10 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-[#8C3B2B] focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
                  />
                  {filters.searchQuery && (
                    <button
                      type="button"
                      onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
                      aria-label="مسح نص البحث"
                      className="absolute left-2 top-1/2 -translate-y-1/2 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Filter Dropdowns (Side-by-side on a single row, Zero Horizontal Scroll) */}
                <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-3.5 sm:p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="min-w-0">
                      <label htmlFor="timeline-temporal-select" className="sr-only">
                        تصفية حسب الزمن
                      </label>
                      <select
                        id="timeline-temporal-select"
                        aria-label="تصفية حسب الزمن"
                        value={filters.temporal}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            temporal: e.target.value as 'all' | TemporalPosition,
                          }))
                        }
                        className="w-full min-w-0 min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 focus:border-[#8C3B2B] focus:outline-none cursor-pointer"
                      >
                        <option value="all">الزمن: الكل</option>
                        <option value="future">القادمة</option>
                        <option value="today">اليوم</option>
                        <option value="past">الماضية</option>
                      </select>
                    </div>

                    <div className="min-w-0">
                      <label htmlFor="timeline-category-select" className="sr-only">
                        تصفية حسب التصنيف
                      </label>
                      <select
                        id="timeline-category-select"
                        aria-label="تصفية حسب التصنيف"
                        value={filters.categoryId}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            categoryId: e.target.value,
                          }))
                        }
                        className="w-full min-w-0 min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 focus:border-[#8C3B2B] focus:outline-none cursor-pointer"
                      >
                        <option value="all">كل التصنيفات</option>
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {hasActiveFilters && (
                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => setFilters(INITIAL_FILTERS)}
                        className="text-xs font-medium text-[#8C3B2B] dark:text-[#E28A6D] hover:underline cursor-pointer"
                      >
                        إعادة ضبط التصفية ({filteredEvents.length})
                      </button>
                    </div>
                  )}

                  {/* Mobile Quick Year Jump Strip (Wraps cleanly — Zero horizontal scroll) */}
                  {quickYears.length > 0 && (
                    <div className="lg:hidden flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-stone-800/80">
                      <button
                        type="button"
                        onClick={() => setFilters((prev) => ({ ...prev, year: 'all' }))}
                        className={`min-h-[36px] rounded-xl px-3 text-xs font-medium cursor-pointer ${
                          filters.year === 'all'
                            ? 'bg-[#8C3B2B] text-white'
                            : 'bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                        }`}
                      >
                        الكل
                      </button>
                      <div className="flex-1 min-w-0">
                        <select
                          aria-label="اختر السنة"
                          value={filters.year}
                          onChange={(e) => {
                            const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                            setFilters((prev) => ({ ...prev, year: val }));
                          }}
                          className="w-full min-h-[36px] rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-xs font-medium text-stone-800 dark:text-stone-100 cursor-pointer"
                        >
                          <option value="all">اختر السنة...</option>
                          {quickYears.map((qy) => (
                            <option key={qy.year} value={qy.year}>
                              {qy.year} ({qy.count})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Empty Archive State */}
                {events.length === 0 ? (
                  <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 sm:p-12 text-center space-y-5">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#8C3B2B]/10 dark:bg-[#E28A6D]/15 text-[#8C3B2B] dark:text-[#E28A6D]">
                      <CalendarPlus className="w-7 h-7" aria-hidden="true" />
                    </div>
                    <div className="mx-auto max-w-md space-y-2">
                      <h2 className="text-xl sm:text-2xl font-bold text-stone-900 dark:text-stone-100">
                        أرشيفك الشخصي يبدأ هنا
                      </h2>
                      <p className="text-sm leading-relaxed text-stone-600 dark:text-stone-400">
                        سجّل ذكرياتك الماضية وخططك المستقبلية مع التاريخين الميلادي والهجري والمرفقات. تُحفظ جميع بياناتك محليًا على جهازك وتعمل دون اتصال بالإنترنت.
                      </p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                      <button
                        type="button"
                        onClick={handleOpenNewEvent}
                        className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-6 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer"
                      >
                        <CalendarPlus className="w-4 h-4" aria-hidden="true" />
                        <span>تسجيل أول حدث</span>
                      </button>
                      <button
                        type="button"
                        disabled={seedingSamples}
                        onClick={handleLoadSamples}
                        className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#141413] px-5 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors disabled:opacity-60 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
                        <span>{seedingSamples ? 'جارٍ التحميل...' : 'استكشاف بأمثلة جاهزة'}</span>
                      </button>
                    </div>
                  </div>
                ) : filteredEvents.length === 0 ? (
                  <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 text-center space-y-3">
                    <p className="text-base font-bold text-stone-900 dark:text-stone-100">
                      لا توجد أحداث مطابقة للتصفية الحالية
                    </p>
                    <p className="text-sm text-stone-500 dark:text-stone-400">
                      جرّب تعديل كلمات البحث أو اختيار تصنيف وسنة أخرى.
                    </p>
                    <button
                      type="button"
                      onClick={() => setFilters(INITIAL_FILTERS)}
                      className="min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 px-5 py-2 text-sm font-medium text-stone-800 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer"
                    >
                      إظهار جميع الأحداث
                    </button>
                  </div>
                ) : (
                  <div className="space-y-10">
                    {/* Future Years Section */}
                    {horizon.futureYears.length > 0 && (
                      <div className="space-y-8">
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-[#8C3B2B] dark:text-[#E28A6D] shadow-2xs">
                            الأحداث المستقبلية والخطط القادمة
                          </span>
                        </div>
                        {renderYearGroups(horizon.futureYears, 'future')}
                      </div>
                    )}

                    {/* Today Horizon Divider */}
                    <section
                      id="today-horizon"
                      aria-label="فاصل اليوم"
                      className="scroll-mt-24 space-y-4"
                    >
                      <div className="relative flex flex-wrap items-center gap-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-[#8C3B2B] dark:bg-[#B8543F] px-3.5 py-2 text-white shadow-xs max-w-full">
                          <Compass className="w-4 h-4 shrink-0" aria-hidden="true" />
                          <span className="text-sm font-bold">اليوم</span>
                          <span className="text-xs opacity-90 tabular-nums">
                            {todayLabels.gregorian}
                          </span>
                        </div>
                        <div className="h-px flex-1 min-w-[24px] bg-[#8C3B2B]/30 dark:bg-[#E28A6D]/30" />
                      </div>

                      {horizon.todayEvents.length > 0 && (
                        <div className="border-r-2 border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 mr-2 sm:mr-3">
                          {horizon.todayEvents.map((ev) => (
                            <TimelineEventRow
                              key={ev.id}
                              event={ev}
                              category={categoriesMap.get(ev.categoryId)}
                              thread={ev.threadId ? threadsMap.get(ev.threadId) : undefined}
                              today={today}
                              onSelect={setSelectedEvent}
                            />
                          ))}
                        </div>
                      )}
                    </section>

                    {/* Past Years Section */}
                    {horizon.pastYears.length > 0 && (
                      <div className="space-y-8">
                        <div className="flex items-center">
                          <span className="inline-flex items-center px-3 py-1 rounded-xl border border-stone-200 dark:border-stone-700 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-700 dark:text-stone-300 shadow-2xs">
                            الذكريات والأحداث الماضية
                          </span>
                        </div>
                        {renderYearGroups(horizon.pastYears, 'past')}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop Sidebar: Quick Jump Index + Archive Stats + PWA */}
              <YearJumpIndex
                years={quickYears}
                selectedYear={filters.year}
                totalCount={archiveCounts.total}
                futureCount={archiveCounts.future}
                pastCount={archiveCounts.past}
                onSelectYear={(year) => setFilters((prev) => ({ ...prev, year }))}
                onJumpToYearAnchor={(year) => scrollToElementId(`year-${year}`)}
                onJumpToToday={() => {
                  setFilters((prev) => ({ ...prev, year: 'all', temporal: 'all' }));
                  scrollToElementId('today-horizon');
                }}
              />
            </div>
          </div>
        )}
      </main>

      <MobileBottomBar
        activeView={activeView}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onChangeView={handleNavigateView}
      />

      <OfflineIndicator />

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          category={categoriesMap.get(selectedEvent.categoryId)}
          thread={selectedEvent.threadId ? threadsMap.get(selectedEvent.threadId) : undefined}
          today={today}
          onClose={() => {
            if (selectedEvent) window.history.back();
          }}
          onEdit={handleOpenEditEvent}
          onDelete={handleDeleteEvent}
          onTogglePin={handleTogglePin}
        />
      )}

      {formOpen && (
        <EventFormModal
          editingEvent={editingEvent}
          categories={categories}
          threads={threads}
          initialThreadId={defaultThreadId}
          onClose={() => {
            if (formOpen) window.history.back();
          }}
          onSave={handleSaveEvent}
        />
      )}
    </div>
  );
}
