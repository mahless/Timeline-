import React, { useMemo, useState } from 'react';
import { Loader2, Search, Send, Sparkles, WifiOff } from 'lucide-react';
import { buildMemoryContextForAI, searchEventsSemanticOffline } from '../domain/assistant';
import { CATEGORY_COLOR_META } from '../domain/defaults';
import { formatEventGregorianDate, formatTodayHeader } from '../domain/timeline';
import type { Category, DateParts, EventThread, TimelineEvent } from '../domain/types';
import { useOnlineStatus } from '../pwa/useOnlineStatus';

interface AssistantViewProps {
  events: TimelineEvent[];
  categoriesMap: Map<string, Category>;
  threadsMap: Map<string, EventThread>;
  today: DateParts;
  onSelectEvent: (event: TimelineEvent) => void;
}

interface AiResponsePayload {
  answer: string;
  matchedEventIds: string[];
  followUpSuggestions: string[];
}

const STARTER_PROMPTS = [
  'ما أبرز أحداثي المهنية المسجلة؟',
  'ما المواعيد والخطط القادمة القريبة؟',
  'متى كانت آخر رحلة أو مناسبة سفر؟',
];

export const AssistantView: React.FC<AssistantViewProps> = ({
  events,
  categoriesMap,
  threadsMap,
  today,
  onSelectEvent,
}) => {
  const isOnline = useOnlineStatus();
  const [mode, setMode] = useState<'ai' | 'semantic'>('ai');

  // AI Q&A state
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiResponsePayload | null>(null);

  // Offline semantic search state
  const [semanticQuery, setSemanticQuery] = useState('');

  const eventsMap = useMemo(
    () => new Map<string, TimelineEvent>(events.map((e) => [e.id, e])),
    [events],
  );

  const semanticHits = useMemo(
    () => searchEventsSemanticOffline(events, categoriesMap, threadsMap, semanticQuery),
    [events, categoriesMap, threadsMap, semanticQuery],
  );

  const handleAsk = async (promptText?: string) => {
    const q = (promptText ?? question).trim();
    if (!q) return;
    if (promptText) setQuestion(promptText);

    if (!isOnline) {
      setAiError('أنت غير متصل بالإنترنت حاليًا. يمكنك التبديل إلى البحث الدلالي المحلي الذي يعمل دون اتصال.');
      return;
    }

    setAsking(true);
    setAiError(null);
    try {
      const todayLabels = formatTodayHeader(today);
      const contextEvents = buildMemoryContextForAI(events, categoriesMap, threadsMap);

      const response = await fetch('/api/ai/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          todayLabel: `${todayLabels.gregorian} (${todayLabels.hijri})`,
          events: contextEvents,
        }),
      });

      const data = (await response.json()) as Partial<AiResponsePayload> & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || 'تعذر استلام إجابة من المساعد الذكي.');
      }

      setAiResult({
        answer: data.answer ?? '',
        matchedEventIds: Array.isArray(data.matchedEventIds) ? data.matchedEventIds : [],
        followUpSuggestions: Array.isArray(data.followUpSuggestions)
          ? data.followUpSuggestions
          : [],
      });
    } catch (err) {
      setAiError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء الاتصال بالمساعد الذكي.',
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <section className="mx-auto max-w-4xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 [text-wrap:balance]">
          المساعد الذكي والبحث الدلالي
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          اسأل المساعد الذكي عن ذكرياتك (مقيد حرفيًا بأحداثك المسجلة فقط)، أو ابحث مفاهيميًا محليًا بدون إنترنت.
        </p>
      </div>

      {/* Mode Switcher */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-1.5">
        <button
          type="button"
          onClick={() => setMode('ai')}
          className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
            mode === 'ai'
              ? 'bg-[#8C3B2B] text-white'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>المساعد الذكي</span>
        </button>

        <button
          type="button"
          onClick={() => setMode('semantic')}
          className={`min-h-[42px] inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
            mode === 'semantic'
              ? 'bg-[#8C3B2B] text-white'
              : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
          }`}
        >
          <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>بحث دلالي محلي</span>
        </button>
      </div>

      {mode === 'ai' ? (
        <div className="space-y-5">
          {!isOnline && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/70 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/50 p-4 text-xs sm:text-sm text-amber-900 dark:text-amber-100">
              <div className="flex items-center gap-2">
                <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>الاتصال بالإنترنت متوقف — المساعد الذكي يتطلب اتصالًا، بينما البحث الدلالي المحلي يعمل دائمًا.</span>
              </div>
              <button
                type="button"
                onClick={() => setMode('semantic')}
                className="font-bold underline cursor-pointer"
              >
                فتح البحث المحلي
              </button>
            </div>
          )}

          {/* Ask Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAsk();
            }}
            className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-4 sm:p-5 space-y-4"
          >
            <div>
              <label
                htmlFor="ai-question-input"
                className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs"
              >
                اسأل أرشيفك الشخصي
              </label>
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <input
                id="ai-question-input"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="مثال: متى بدأت مشروعي الأول؟ أو ما خططي لعام 2027؟"
                className="flex-1 min-w-0 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-[#8C3B2B] focus:outline-none"
              />
              <button
                type="submit"
                disabled={asking || !question.trim()}
                aria-label="إرسال السؤال للمساعد"
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 cursor-pointer shrink-0"
              >
                {asking ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="w-4 h-4" aria-hidden="true" />
                )}
                <span>اسأل</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {STARTER_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleAsk(prompt)}
                  className="min-h-[34px] rounded-lg border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 py-1 text-xs text-stone-700 dark:text-stone-300 hover:border-[#8C3B2B] dark:hover:border-[#E28A6D] cursor-pointer text-right"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </form>

          {aiError && (
            <div role="alert" className="rounded-2xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 p-4 text-sm text-red-800 dark:text-red-200 space-y-2">
              <p>{aiError}</p>
              <button
                type="button"
                onClick={() => setMode('semantic')}
                className="text-xs font-bold underline cursor-pointer"
              >
                جرّب البحث الدلالي المحلي الآن
              </button>
            </div>
          )}

          {aiResult && (
            <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
              <div>
                <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-[#8C3B2B] dark:text-[#E28A6D] shadow-2xs">
                  الإجابة من سجلاتك المسجلة
                </h2>
                <p className="mt-2 whitespace-pre-line text-sm sm:text-base leading-relaxed text-stone-900 dark:text-stone-100 break-words">
                  {aiResult.answer}
                </p>
              </div>

              {aiResult.matchedEventIds.length > 0 && (
                <div className="pt-3 border-t border-stone-100 dark:border-stone-800 space-y-2">
                  <h3 className="text-xs font-medium text-stone-500 dark:text-stone-400">
                    الأحداث المرجعية المستند إليها:
                  </h3>
                  <div className="space-y-2">
                    {aiResult.matchedEventIds.map((id) => {
                      const ev = eventsMap.get(id);
                      if (!ev) return null;
                      const cat = categoriesMap.get(ev.categoryId);
                      const colorMeta = CATEGORY_COLOR_META[cat?.colorKey ?? 'slate'];
                      return (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => onSelectEvent(ev)}
                          className="w-full text-right flex flex-col items-stretch rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] p-3 hover:border-[#8C3B2B] cursor-pointer"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 text-xs text-stone-500 dark:text-stone-400">
                            <span className={`font-medium ${colorMeta.textClass}`}>
                              {cat?.name ?? 'عام'}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{formatEventGregorianDate(ev)}</span>
                          </div>
                          <p className="mt-1 text-sm font-bold text-stone-900 dark:text-stone-100 break-words">
                            {ev.title}
                          </p>
                          {ev.description && (
                            <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2 break-words">
                              {ev.description}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {aiResult.followUpSuggestions.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-2">
                  {aiResult.followUpSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => handleAsk(s)}
                      className="min-h-[34px] rounded-lg border border-stone-200 dark:border-stone-700 px-3 py-1 text-xs text-[#8C3B2B] dark:text-[#E28A6D] hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer text-right"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-4 sm:p-5 space-y-2.5">
            <div>
              <label
                htmlFor="semantic-search-input"
                className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs"
              >
                البحث الدلالي المفاهيمي (يعمل 100% محليًا ودون إنترنت)
              </label>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
              <input
                id="semantic-search-input"
                type="search"
                value={semanticQuery}
                onChange={(e) => setSemanticQuery(e.target.value)}
                placeholder="مثال: وظيفة، تأشيرة، ادخار، دراسة، عائلة..."
                className="w-full min-w-0 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] pr-10 pl-3.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:border-[#8C3B2B] focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
              />
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              يوسّع البحث تلقائيًا للمفاهيم والمرادفات المرتبطة في العربية حتى عند اختلاف الكلمات الدقيقة.
            </p>
          </div>

          {semanticQuery.trim() && (
            semanticHits.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 text-center">
                <p className="text-sm text-stone-500 dark:text-stone-400">
                  لم يتم العثور على أحداث مرتبطة بهذا المفهوم.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {semanticHits.map(({ event, matchedConcepts }) => {
                  const cat = categoriesMap.get(event.categoryId);
                  const colorMeta = CATEGORY_COLOR_META[cat?.colorKey ?? 'slate'];
                  return (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => onSelectEvent(event)}
                      className="w-full text-right flex flex-col items-stretch rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-4 hover:border-[#8C3B2B] cursor-pointer"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 dark:text-stone-400">
                        <span className={`font-medium ${colorMeta.textClass}`}>
                          {cat?.name ?? 'عام'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{formatEventGregorianDate(event)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{event.hijriFormatted}</span>
                      </div>
                      <h3 className="mt-1.5 text-base font-bold text-stone-900 dark:text-stone-100 break-words">
                        {event.title}
                      </h3>
                      {event.description && (
                        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400 line-clamp-2 break-words">
                          {event.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-[#8C3B2B] dark:text-[#E28A6D]">
                        تطابق مفاهيمي: {matchedConcepts.join(' · ')}
                      </p>
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      )}
    </section>
  );
};
