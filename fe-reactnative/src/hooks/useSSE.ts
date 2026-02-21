export function useSSE(url: string, onChunk: (chunk: string) => void, onDone: () => void) {
  const startSSE = async (body: unknown) => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.body) {
        throw new Error('No body in response');
      }

      if (typeof window !== 'undefined' && 'ReadableStream' in window) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let finished = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '__DONE__') {
                finished = true;
                break;
              }
              if (data) onChunk(data);
            }
          }
          if (finished) break;
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
