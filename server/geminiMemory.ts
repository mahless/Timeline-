import { GoogleGenAI, Type } from '@google/genai';

export interface MemoryQueryRequest {
  question: string;
  todayLabel?: string;
  events: Array<{
    id: string;
    title: string;
    gregorianDate: string;
    hijriDate: string;
    sortDateKey: string;
    time?: string;
    category: string;
    thread?: string;
    location?: string;
    description: string;
    keywords: string[];
    isPinned: boolean;
    recurrence?: string;
  }>;
}

export interface MemoryQueryResponse {
  answer: string;
  matchedEventIds: string[];
  followUpSuggestions: string[];
}

export class MemoryAssistantHttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function askMemoryAssistant(
  body: MemoryQueryRequest,
): Promise<MemoryQueryResponse> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new MemoryAssistantHttpError(
      503,
      'ميزة المساعد الذكي تتطلب إعداد GEMINI_API_KEY في متغيرات البيئة على الخادم. يمكنك استخدام البحث الدلالي المحلي بدون إنترنت.',
    );
  }

  const question = typeof body.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 600) {
    throw new MemoryAssistantHttpError(400, 'يرجى كتابة سؤال واضح (بحد أقصى 600 حرف).');
  }

  const events = Array.isArray(body.events) ? body.events.slice(0, 180) : [];
  if (events.length === 0) {
    return {
      answer: 'لا توجد أحداث مسجلة في أرشيفك حتى الآن للإجابة عنها. أضف أحداثًا أو ذكريات أولًا ثم اسألني عنها.',
      matchedEventIds: [],
      followUpSuggestions: [],
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemInstruction = [
    'أنت المساعد الذكي لتطبيق Timeline للأرشيف الرقمي الشخصي.',
    'القاعدة الصارمة: أجب باللغة العربية فقط وبشكل موجز ودقيق اعتمادًا حرفيًا وحصريًا على قائمة الأحداث المرفقة في JSON فقط.',
    'ممنوع تمامًا اختلاق أو تخمين أي تاريخ أو حدث أو موقع أو تفصيل غير موجود في الأحداث المرفقة.',
    'إذا لم يرد جواب في الأحداث المسجلة، قل بوضوح: "لا توجد معلومة مسجلة في أرشيفك تجيب عن هذا السؤال."',
    'أعد معرّفات الأحداث المرتبطة فعليًا بالإجابة في matchedEventIds، ولا تتجاوز 3 اقتراحات متابعة قصيرة في followUpSuggestions.',
  ].join('\n');

  const prompt = JSON.stringify({
    today: body.todayLabel ?? '',
    question,
    archiveEvents: events,
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.STRING,
              description: 'الإجابة العربية المستندة حصريًا إلى الأحداث المرفقة.',
            },
            matchedEventIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'معرّفات الأحداث التي استندت إليها الإجابة.',
            },
            followUpSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'اقتراحات أسئلة متابعة قصيرة بالعربية.',
            },
          },
          required: ['answer', 'matchedEventIds', 'followUpSuggestions'],
        },
      },
    });

    const rawText = (response.text ?? '').trim();
    const parsed = JSON.parse(rawText) as Partial<MemoryQueryResponse>;
    const validIds = new Set(events.map((e) => e.id));

    return {
      answer:
        typeof parsed.answer === 'string' && parsed.answer.trim()
          ? parsed.answer.trim()
          : 'لا توجد معلومة مسجلة في أرشيفك تجيب عن هذا السؤال.',
      matchedEventIds: Array.isArray(parsed.matchedEventIds)
        ? parsed.matchedEventIds.filter((id): id is string => typeof id === 'string' && validIds.has(id))
        : [],
      followUpSuggestions: Array.isArray(parsed.followUpSuggestions)
        ? parsed.followUpSuggestions
            .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
            .slice(0, 3)
        : [],
    };
  } catch (err) {
    if (err instanceof MemoryAssistantHttpError) {
      throw err;
    }
    const rawMsg = err instanceof Error ? err.message : '';
    const lower = rawMsg.toLowerCase();

    if (
      lower.includes('503') ||
      lower.includes('unavailable') ||
      lower.includes('high demand') ||
      lower.includes('overloaded')
    ) {
      throw new MemoryAssistantHttpError(
        503,
        'خدمة المساعد الذكي تشهد ضغطًا مرتفعًا حاليًا. يرجى المحاولة بعد لحظات، أو استخدام البحث الدلالي المحلي الآن.',
      );
    }

    if (lower.includes('429') || lower.includes('resource_exhausted') || lower.includes('quota')) {
      throw new MemoryAssistantHttpError(
        429,
        'تم تجاوز حد الطلبات المؤقت لخدمة الذكاء الاصطناعي. يرجى المحاولة بعد قليل.',
      );
    }

    if (lower.includes('api key') || lower.includes('401') || lower.includes('403') || lower.includes('permission')) {
      throw new MemoryAssistantHttpError(
        503,
        'تعذر التحقق من صلاحية مفتاح الذكاء الاصطناعي على الخادم.',
      );
    }

    throw new MemoryAssistantHttpError(
      502,
      'تعذر الحصول على رد من المساعد الذكي حاليًا. يمكنك المحاولة مرة أخرى أو استخدام البحث الدلالي المحلي.',
    );
  }
}
