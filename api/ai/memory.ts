import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  askMemoryAssistant,
  MemoryAssistantHttpError,
  type MemoryQueryRequest,
} from '../../server/geminiMemory.ts';

export default async function handler(
  req: IncomingMessage & { method?: string; body?: unknown },
  res: ServerResponse & {
    status?: (code: number) => unknown;
    json?: (body: unknown) => void;
  },
) {
  const sendJson = (status: number, body: unknown) => {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'POST') {
    sendJson(405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    let payload: MemoryQueryRequest;
    if (req.body && typeof req.body === 'object') {
      payload = req.body as MemoryQueryRequest;
    } else {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as MemoryQueryRequest;
    }

    const result = await askMemoryAssistant(payload);
    sendJson(200, result);
  } catch (err) {
    if (err instanceof MemoryAssistantHttpError) {
      sendJson(err.status, { error: err.message });
      return;
    }
    sendJson(500, {
      error: err instanceof Error ? err.message : 'حدث خطأ غير متوقع في الخادم.',
    });
  }
}
