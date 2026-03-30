import { getAccessToken } from '../auth/session';
import { getBaseURL } from '../services/api';

export function useSSE(url: string, onChunk: (chunk: string) => void, onDone: (syllabusId?: string) => void) {
  const startSSE = async (body: unknown) => {
    try {
      const res = await fetch(`${getBaseURL()}${url}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (!res.body) throw new Error('No body in response');

      if (typeof window !== 'undefined' && 'ReadableStream' in window) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (currentEvent === 'done') {
                try {
                  const parsed = JSON.parse(data) as { syllabus_id?: string };
                  onDone(parsed.syllabus_id);
                } catch {
                  onDone();
                }
                return;
              } else if (currentEvent === 'error') {
                throw new Error(data);
              } else if (data) {
                onChunk(data);
              }
            }
          }
        }

        onDone();
      } else {
        const text = await res.text();
        onChunk(text);
        onDone();
      }
    } catch (e) {
      console.error('SSE Error:', e);
      onDone();
    }
  };

  return { startSSE };
}
