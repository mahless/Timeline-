import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../pwa/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1E1D1B] px-4 py-2.5 text-sm font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer text-center"
      >
        <Download className="w-4 h-4 shrink-0 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
        <span>تثبيت التطبيق على الجهاز</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-stone-200 dark:border-stone-800 bg-white/70 dark:bg-[#1E1D1B] px-4 py-2.5 text-sm font-medium text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors cursor-pointer text-center"
      >
        <Smartphone className="w-4 h-4 shrink-0 text-[#8C3B2B] dark:text-[#E28A6D]" aria-hidden="true" />
        <span>{isIOS ? 'تثبيت على iPhone / iPad' : 'تثبيت كتطبيق (PWA)'}</span>
      </button>

      {showGuide && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-stone-800 bg-[#FAF8F4] dark:bg-[#1E1D1B] p-6 shadow-xl">
            <div className="flex items-center justify-between gap-4">
              <h3 id="pwa-guide-title" className="text-lg font-bold text-stone-900 dark:text-stone-100">
                تثبيت Timeline على جهازك
              </h3>
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                aria-label="إغلاق نافذة التثبيت"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isIOS ? (
              <ol className="mt-4 space-y-3 text-sm text-stone-700 dark:text-stone-300 leading-relaxed list-decimal list-inside">
                <li>افتح التطبيق عبر متصفح <strong>Safari</strong>.</li>
                <li>اضغط على زر <strong>المشاركة (Share)</strong> في شريط المتصفح السفلي.</li>
                <li>مرّر للأسفل واختر <strong>إضافة إلى الشاشة الرئيسية (Add to Home Screen)</strong>.</li>
              </ol>
            ) : (
              <ol className="mt-4 space-y-3 text-sm text-stone-700 dark:text-stone-300 leading-relaxed list-decimal list-inside">
                <li>اضغط على قائمة المتصفح أو أيقونة التثبيت في شريط العنوان.</li>
                <li>اختر <strong>تثبيت التطبيق (Install App)</strong> أو <strong>إضافة للشاشة الرئيسية</strong>.</li>
                <li>بعد التحميل الأول سيعمل التطبيق ويحفظ أحداثك محليًا حتى بدون إنترنت.</li>
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="mt-6 w-full min-h-[44px] rounded-xl bg-[#8C3B2B] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#732F21] transition-colors cursor-pointer"
            >
              حسنًا
            </button>
          </div>
        </div>
      )}
    </>
  );
};
