import type {
  Category,
  CategoryColorKey,
  DateParts,
  EventFormInput,
  EventThread,
} from './types';

export const CATEGORY_COLOR_META: Record<
  CategoryColorKey,
  {
    label: string;
    dotClass: string;
    textClass: string;
    swatchBg: string;
  }
> = {
  terracotta: {
    label: 'طوبي أرشيفي',
    dotClass: 'bg-[#8C3B2B] dark:bg-[#D97757]',
    textClass: 'text-[#8C3B2B] dark:text-[#E28A6D]',
    swatchBg: '#8C3B2B',
  },
  lapis: {
    label: 'لازوردي عميق',
    dotClass: 'bg-[#1E40AF] dark:bg-[#60A5FA]',
    textClass: 'text-[#1E40AF] dark:text-[#93C5FD]',
    swatchBg: '#1E40AF',
  },
  forest: {
    label: 'أخضر زيتوني',
    dotClass: 'bg-[#166534] dark:bg-[#4ADE80]',
    textClass: 'text-[#166534] dark:text-[#86EFAC]',
    swatchBg: '#166534',
  },
  bronze: {
    label: 'برونزي دافئ',
    dotClass: 'bg-[#92400E] dark:bg-[#FBBF24]',
    textClass: 'text-[#92400E] dark:text-[#FCD34D]',
    swatchBg: '#92400E',
  },
  slate: {
    label: 'رمادي صخري',
    dotClass: 'bg-[#334155] dark:bg-[#94A3B8]',
    textClass: 'text-[#334155] dark:text-[#CBD5E1]',
    swatchBg: '#334155',
  },
  plum: {
    label: 'بنفسجي وقور',
    dotClass: 'bg-[#6B21A8] dark:bg-[#C084FC]',
    textClass: 'text-[#6B21A8] dark:text-[#D8B4FE]',
    swatchBg: '#6B21A8',
  },
};

export function createDefaultCategories(nowIso = new Date().toISOString()): Category[] {
  return [
    {
      id: 'cat-personal',
      name: 'شخصي',
      colorKey: 'terracotta',
      isDefault: true,
      order: 1,
      createdAt: nowIso,
    },
    {
      id: 'cat-family',
      name: 'عائلي',
      colorKey: 'lapis',
      isDefault: true,
      order: 2,
      createdAt: nowIso,
    },
    {
      id: 'cat-career',
      name: 'مهني',
      colorKey: 'slate',
      isDefault: true,
      order: 3,
      createdAt: nowIso,
    },
    {
      id: 'cat-finance',
      name: 'مالي',
      colorKey: 'bronze',
      isDefault: true,
      order: 4,
      createdAt: nowIso,
    },
    {
      id: 'cat-travel',
      name: 'سفر',
      colorKey: 'forest',
      isDefault: true,
      order: 5,
      createdAt: nowIso,
    },
    {
      id: 'cat-religious',
      name: 'ديني ومناسبات',
      colorKey: 'plum',
      isDefault: true,
      order: 6,
      createdAt: nowIso,
    },
  ];
}

export function createSampleThreads(nowIso = new Date().toISOString()): EventThread[] {
  return [
    {
      id: 'thread-career',
      title: 'المسيرة المهنية وتطوير الذات',
      description: 'سلسلة تجمع المحطات الوظيفية، التوقيعات المهمة، ومشاريع التطوير الشخصي.',
      colorKey: 'slate',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'thread-travel',
      title: 'خطة السفر والرحلات',
      description: 'التحضيرات والتجديدات ومواعيد الرحلات القادمة والماضية.',
      colorKey: 'forest',
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}

function shiftDays(parts: DateParts, deltaDays: number): DateParts {
  const dt = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + deltaDays));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

export function createSampleEventInputs(today: DateParts): EventFormInput[] {
  const nextWeek = shiftDays(today, 5);
  const nextMonth = shiftDays(today, 22);
  const nextYear = { year: today.year + 1, month: 3, day: 15 };
  const lastWeek = shiftDays(today, -9);
  const lastYear = { year: today.year - 1, month: 6 };

  return [
    {
      title: 'تجديد جواز السفر والتخطيط لرحلة الصيف',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: nextWeek.year,
      month: nextWeek.month,
      day: nextWeek.day,
      time: '10:30',
      categoryId: 'cat-travel',
      description: 'مراجعة الأوراق المطلوبة وحجز موعد الصباح في الجوازات، ثم ترتيب خطة السفر السنوية.',
      location: 'مكتب الجوازات المركزي',
      keywords: ['سفر', 'جواز', 'تخطيط'],
      isPinned: true,
      threadId: 'thread-travel',
      reminders: [
        { id: 'sample-rem-1', offset: 'week_before', time: '09:00' },
        { id: 'sample-rem-2', offset: 'day_before', time: '18:00' },
      ],
    },
    {
      title: 'مراجعة الخطة السنوية للمشاريع والأهداف',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: nextMonth.year,
      month: nextMonth.month,
      day: nextMonth.day,
      time: '16:00',
      categoryId: 'cat-career',
      description: 'مراجعة دورية متكررة سنويًا لتقييم ما تحقق ووضع أهداف المرحلة القادمة.',
      keywords: ['أهداف', 'مراجعة', 'تخطيط'],
      threadId: 'thread-career',
      recurrence: { frequency: 'yearly', calendar: 'gregorian' },
      reminders: [{ id: 'sample-rem-3', offset: 'same_day', time: '09:00' }],
    },
    {
      title: 'هدف الادخار السنوي للمشروع الشخصي',
      datePrecision: 'month',
      calendarInput: 'gregorian',
      year: nextYear.year,
      month: nextYear.month,
      categoryId: 'cat-finance',
      description: 'تاريخ تقريبي لمراجعة ميزانية المشروع وتقييم إمكانية إطلاق النسخة الأولى.',
      keywords: ['مالية', 'ادخار', 'مشروع'],
      threadId: 'thread-career',
    },
    {
      title: 'بدء توثيق أرشيف Timeline الشخصي',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: today.year,
      month: today.month,
      day: today.day,
      time: '09:00',
      categoryId: 'cat-personal',
      description: 'تخصيص مساحة رقمية هادئة تحفظ ذكرياتي ومواعيدي المهمة محليًا دون تشتيت.',
      keywords: ['بداية', 'توثيق', 'أرشيف'],
    },
    {
      title: 'لقاء عائلي في منزل الجد',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: lastWeek.year,
      month: lastWeek.month,
      day: lastWeek.day,
      time: '19:30',
      categoryId: 'cat-family',
      description: 'أمسية هادئة مع العائلة وتبادل الذكريات القديمة على العشاء.',
      location: 'منزل العائلة',
      keywords: ['عائلة', 'ذكريات', 'لقاء'],
    },
    {
      title: 'تخرّج وبداية أول مشروع مستقل',
      datePrecision: 'exact',
      calendarInput: 'gregorian',
      year: today.year - 2,
      month: today.month,
      day: today.day,
      categoryId: 'cat-career',
      description: 'ذكرى صادفت مثل هذا اليوم قبل سنتين — نقطة التحول الأولى في المسار المهني.',
      keywords: ['إنجاز', 'بداية', 'ذكرى'],
      threadId: 'thread-career',
    },
    {
      title: 'الانتقال إلى الدور المهني الجديد',
      datePrecision: 'month',
      calendarInput: 'gregorian',
      year: lastYear.year,
      month: lastYear.month,
      categoryId: 'cat-career',
      description: 'بداية مرحلة مهنية جديدة ومسؤوليات قيادية أوسع في إدارة المنتجات.',
      keywords: ['عمل', 'ترقية', 'إنجاز'],
      threadId: 'thread-career',
    },
    {
      title: 'أول رحلة عمرة مع الوالدين',
      datePrecision: 'year',
      calendarInput: 'gregorian',
      year: today.year - 4,
      categoryId: 'cat-religious',
      description: 'ذكرى لا تُنسى من السنوات الماضية (بتاريخ تقريبي على مستوى السنة).',
      location: 'مكة المكرمة',
      keywords: ['عمرة', 'ديني', 'سفر'],
      threadId: 'thread-travel',
    },
  ];
}
