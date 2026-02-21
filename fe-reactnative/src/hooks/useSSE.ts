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

      // Check if we are in a web environment (browser)
      if (typeof window !== 'undefined' && 'ReadableStream' in window) {
         const reader = res.body.getReader();
         const decoder = new TextDecoder();
         while (true) {
           const { done, value } = await reader.read();
           if (done) break;
           const text = decoder.decode(value, { stream: true });
           const lines = text.split('\n');
           for (const line of lines) {
             if (line.startsWith('data: ')) {
               const data = line.slice(6).trim();
               if (data === '__DONE__') {
                 onDone();
                 return;
               }
               if (data) onChunk(data);
             }
           }
         }
      } else {
        // Fallback for non-web environments (less likely for this project but good practice)
        // React Native fetch doesn't support streaming body reads easily without polyfills
        // For this task targeting Expo Web primarily, the above covers it.
        // If native streaming is needed, we'd use 'react-native-fetch-api' or similar.
        const text = await res.text();
        onChunk(text); // Just dump everything if no streaming support
        onDone();
      }
      onDone();
    } catch (e) {
      console.error('SSE Error:', e);
      onDone(); // End on error
    }
  };
  
  return { startSSE };
}
