import React, { useState } from 'react';
import { Check, Edit2, Moon, Plus, Sun, Trash2, X } from 'lucide-react';
import { CATEGORY_COLOR_META } from '../domain/defaults';
import type { Category, CategoryColorKey, TimelineEvent } from '../domain/types';
import { PWAInstallButton } from './PWAInstallButton';

interface CategoriesViewProps {
  categories: Category[];
  events: TimelineEvent[];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onAddCategory: (name: string, colorKey: CategoryColorKey) => Promise<void>;
  onUpdateCategory: (category: Category) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

const COLOR_KEYS: CategoryColorKey[] = [
  'terracotta',
  'lapis',
  'forest',
  'bronze',
  'slate',
  'plum',
];

export const CategoriesView: React.FC<CategoriesViewProps> = ({
  categories,
  events,
  theme,
  onToggleTheme,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState<CategoryColorKey>('terracotta');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<CategoryColorKey>('slate');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const countByCategory = (catId: string) =>
    events.filter((ev) => ev.categoryId === catId).length;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) {
      setFormError('يرجى كتابة اسم التصنيف.');
      return;
    }
    if (categories.some((c) => c.name.trim() === trimmed)) {
      setFormError('يوجد تصنيف بهذا الاسم بالفعل.');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await onAddCategory(trimmed, newColor);
      setNewName('');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.colorKey);
  };

  const handleSaveEdit = async (cat: Category) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    await onUpdateCategory({
      ...cat,
      name: trimmed,
      colorKey: editColor,
    });
    setEditingId(null);
  };

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 py-8 pb-24 sm:pb-12 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 dark:text-stone-100">
          إدارة التصنيفات والتفضيلات
        </h1>
        <p className="mt-1.5 text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
          نظّم ذكرياتك وأحداثك المستقبلية بالتصنيفات المناسبة لك. عند حذف أي تصنيف، تُنقل أحداثه تلقائيًا إلى التصنيف الأول دون فقدان أي سجل.
        </p>
      </div>

      {/* Add New Category */}
      <form
        onSubmit={handleCreate}
        className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4"
      >
        <div>
          <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
            إضافة تصنيف جديد
          </h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثال: تعليم، صحة، مشاريع..."
            aria-label="اسم التصنيف الجديد"
            className="flex-1 min-h-[44px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3.5 text-sm text-stone-900 dark:text-stone-100 placeholder:text-stone-400"
          />
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#8C3B2B] hover:bg-[#732F21] px-5 py-2 text-sm font-medium text-white transition-colors disabled:opacity-60 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>إضافة تصنيف</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500 dark:text-stone-400 ml-1">اللون المميز:</span>
          {COLOR_KEYS.map((ck) => {
            const meta = CATEGORY_COLOR_META[ck];
            const selected = newColor === ck;
            return (
              <button
                key={ck}
                type="button"
                onClick={() => setNewColor(ck)}
                aria-label={`اختيار لون ${meta.label}`}
                aria-pressed={selected}
                className={`min-h-[36px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  selected
                    ? 'border-stone-900 dark:border-stone-100 bg-stone-100 dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                    : 'border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dotClass}`} aria-hidden="true" />
                <span>{meta.label}</span>
              </button>
            );
          })}
        </div>

        {formError && (
          <p role="alert" className="text-xs text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}
      </form>

      {/* Categories List */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] divide-y divide-stone-100 dark:divide-stone-800/80 overflow-hidden">
        {categories.map((cat) => {
          const meta = CATEGORY_COLOR_META[cat.colorKey];
          const count = countByCategory(cat.id);
          const isEditing = editingId === cat.id;

          return (
            <div key={cat.id} className="p-4 sm:px-5 flex flex-col gap-3">
              {isEditing ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      aria-label={`تعديل اسم التصنيف ${cat.name}`}
                      className="flex-1 min-h-[40px] rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-3 text-sm text-stone-900 dark:text-stone-100"
                    />
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(cat)}
                      aria-label={`حفظ تعديل ${cat.name}`}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#8C3B2B] text-white cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      aria-label="إلغاء التعديل"
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-300 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {COLOR_KEYS.map((ck) => {
                      const cm = CATEGORY_COLOR_META[ck];
                      return (
                        <button
                          key={ck}
                          type="button"
                          onClick={() => setEditColor(ck)}
                          className={`min-h-[34px] inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs cursor-pointer ${
                            editColor === ck
                              ? 'border-stone-900 dark:border-stone-100 bg-stone-100 dark:bg-stone-800'
                              : 'border-stone-200 dark:border-stone-800'
                          }`}
                        >
                          <span className={`h-2.5 w-2.5 rounded-full ${cm.dotClass}`} />
                          <span>{cm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className={`h-3 w-3 rounded-full shrink-0 ${meta.dotClass}`} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-stone-900 dark:text-stone-100 truncate">
                        {cat.name}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 tabular-nums">
                        {count === 0 ? 'لا توجد أحداث' : count === 1 ? 'حدث واحد' : `${count} أحداث`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      aria-label={`تعديل تصنيف ${cat.name}`}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 dark:text-stone-400 dark:hover:bg-stone-800 cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {categories.length > 1 && (
                      confirmDeleteId === cat.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={async () => {
                              await onDeleteCategory(cat.id);
                              setConfirmDeleteId(null);
                            }}
                            className="min-h-[36px] rounded-lg bg-red-700 px-3 text-xs font-medium text-white cursor-pointer"
                          >
                            تأكيد
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[36px] rounded-lg border border-stone-300 dark:border-stone-700 px-2.5 text-xs text-stone-600 dark:text-stone-300 cursor-pointer"
                          >
                            إلغاء
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(cat.id)}
                          aria-label={`حذف تصنيف ${cat.name}`}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-stone-500 hover:bg-red-50 hover:text-red-700 dark:text-stone-400 dark:hover:bg-red-950/40 dark:hover:text-red-400 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* App Preferences & PWA Install */}
      <div className="rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1D1B] p-5 space-y-4">
        <div>
          <h2 className="inline-flex items-center px-3 py-1 rounded-xl border border-[#8C3B2B]/40 dark:border-[#E28A6D]/40 bg-white/80 dark:bg-[#1E1D1B] text-xs sm:text-sm font-bold text-stone-900 dark:text-stone-100 shadow-2xs">
            المظهر والتطبيق المحلي
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#FAF8F4] dark:bg-[#141413] px-4 py-2.5 text-sm font-medium text-stone-800 dark:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            {theme === 'light' ? (
              <>
                <Moon className="w-4 h-4 text-[#8C3B2B]" aria-hidden="true" />
                <span>تفعيل الوضع الداكن</span>
              </>
            ) : (
              <>
                <Sun className="w-4 h-4 text-[#E28A6D]" aria-hidden="true" />
                <span>تفعيل الوضع الفاتح</span>
              </>
            )}
          </button>

          <PWAInstallButton />
        </div>
      </div>
    </section>
  );
};
