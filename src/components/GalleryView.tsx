import React, { useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, FileText, Images, X } from 'lucide-react';
import { formatEventGregorianDate } from '../domain/timeline';
import type { AttachmentRecord, Category, TimelineEvent } from '../domain/types';
import { getAllAttachments } from '../storage/db';

interface GalleryViewProps {
  events: TimelineEvent[];
  categories: Category[];
  lightboxItem: GalleryItem | null;
  setLightboxItem: (item: GalleryItem | null) => void;
  onSelectEvent: (event: TimelineEvent) => void;
}

interface GalleryItem {
  record: AttachmentRecord;
  url: string;
  event?: TimelineEvent;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const GalleryView: React.FC<GalleryViewProps> = ({
  events,
  categories,
  lightboxItem,
  setLightboxItem,
  onSelectEvent,
}) => {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mediaFilter, setMediaFilter] = useState<'all' | 'images' | 'files'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const eventsMap = useMemo(
    () => new Map<string, TimelineEvent>(events.map((e) => [e.id, e])),
    [events],
  );

  useEffect(() => {
    let active = true;
    const urls: string[] = [];

    setLoading(true);
    getAllAttachments()
      .then((records) => {
        if (!active) return;
        const mapped = records.map((record) => {
          const url = URL.createObjectURL(record.blob);
          urls.push(url);
          return {
            record,
            url,
            event: eventsMap.get(record.eventId),
          };
        });
        setItems(mapped);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      for (const u of urls) {
        URL.revokeObjectURL(u);
      }
    };
  }, [eventsMap]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const isImage = item.record.mimeType.startsWith('image/');
      if (mediaFilter === 'images' && !isImage) return false;
      if (mediaFilter === 'files' && isImage) return false;
      if (categoryFilter !== 'all' && item.event?.categoryId !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [items, mediaFilter, categoryFilter]);

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 pb-24 sm:pb-14 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100 [text-wrap:balance]">
          معرض الذكريات والمرفقات
        </h1>
        <p className="mt-1 text-sm text-stone-600 dark:text-stone-400">
          استعرض جميع الصور والملفات المحفوظة محليًا مع إمكانية فتح الحدث المرتبط أو تنزيل أي مرفق دون إنترنت.
        </p>
      </div>

      {/* Filters Row (Two selects side-by-side on one row — zero horizontal scroll) */}
      <div className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-3.5 sm:p-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="min-w-0">
            <label htmlFor="gallery-media-filter" className="sr-only">
              نوع المرفقات
            </label>
            <select
              id="gallery-media-filter"
              value={mediaFilter}
              onChange={(e) => setMediaFilter(e.target.value as 'all' | 'images' | 'files')}
              className="w-full min-w-0 min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 cursor-pointer"
            >
              <option value="all">كل المرفقات ({items.length})</option>
              <option value="images">الصور فقط</option>
              <option value="files">المستندات فقط</option>
            </select>
          </div>

          <div className="min-w-0">
            <label htmlFor="gallery-category-filter" className="sr-only">
              التصنيف
            </label>
            <select
              id="gallery-category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full min-w-0 min-h-[42px] rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-xs sm:text-sm font-medium text-stone-800 dark:text-stone-100 cursor-pointer"
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
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-52 rounded-2xl bg-stone-200/70 dark:bg-stone-800 animate-pulse" />
          <div className="h-52 rounded-2xl bg-stone-200/70 dark:bg-stone-800 animate-pulse" />
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-8 sm:p-12 text-center space-y-3">
          <Images className="w-8 h-8 mx-auto text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
          <p className="text-base font-bold text-stone-900 dark:text-stone-100">
            لا توجد صور أو مرفقات مطابقة
          </p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            أرفق صورًا أو مستندات داخل أي حدث في الخط الزمني لتظهر هنا تلقائيًا.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const isImage = item.record.mimeType.startsWith('image/');
            return (
              <article
                key={item.record.id}
                className="rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] overflow-hidden flex flex-col"
              >
                {isImage ? (
                  <button
                    type="button"
                    onClick={() => setLightboxItem(item)}
                    aria-label={`تكبير الصورة ${item.record.name}`}
                    className="h-48 w-full bg-stone-100 dark:bg-stone-900 overflow-hidden cursor-pointer"
                  >
                    <img
                      src={item.url}
                      alt={item.record.name}
                      className="h-full w-full object-cover hover:scale-[1.02] transition-transform"
                    />
                  </button>
                ) : (
                  <div className="h-48 w-full bg-stone-100 dark:bg-stone-900 flex flex-col items-center justify-center gap-2 p-4 text-center">
                    <FileText className="w-10 h-10 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
                    <span className="text-xs font-medium text-stone-700 dark:text-stone-300 break-all line-clamp-2">
                      {item.record.name}
                    </span>
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                      {item.event ? item.event.title : item.record.name}
                    </p>
                    {item.event?.description && (
                      <p className="mt-0.5 text-xs text-stone-600 dark:text-stone-400 line-clamp-2 break-words">
                        {item.event.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-stone-500 dark:text-stone-400 tabular-nums truncate">
                      {item.event ? formatEventGregorianDate(item.event) : item.record.name} ·{' '}
                      {formatBytes(item.record.size)}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-100 dark:border-stone-800">
                    {item.event ? (
                      <button
                        type="button"
                        onClick={() => item.event && onSelectEvent(item.event)}
                        className="min-h-[36px] inline-flex items-center gap-1 text-xs font-medium text-[#8C3B2B] dark:text-[#E28A6D] hover:underline cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>فتح الحدث</span>
                      </button>
                    ) : (
                      <span />
                    )}

                    <a
                      href={item.url}
                      download={item.record.name}
                      className="min-h-[36px] inline-flex items-center gap-1 rounded-lg border border-stone-200 dark:border-stone-700 px-2.5 py-1 text-xs font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800"
                    >
                      <Download className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>تنزيل</span>
                    </a>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Image Lightbox */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`معاينة ${lightboxItem.record.name}`}
          onClick={() => setLightboxItem(null)}
        >
          <div
            className="max-w-3xl w-full rounded-2xl bg-[#FAF8F4] dark:bg-[#1E1D1B] overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 dark:border-stone-800">
              <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                {lightboxItem.event?.title ?? lightboxItem.record.name}
              </p>
              <button
                type="button"
                onClick={() => setLightboxItem(null)}
                aria-label="إغلاق المعاينة"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-200/60 dark:hover:bg-stone-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-stone-950 flex items-center justify-center max-h-[75vh]">
              <img
                src={lightboxItem.url}
                alt={lightboxItem.record.name}
                className="max-h-[75vh] w-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
