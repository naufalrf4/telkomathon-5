export function getBaseURL(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api/v1`;
  }
  return 'http://localhost:8000/api/v1';
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseURL()}${path}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json() as { data: T };
  return json.data;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getBaseURL()}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  const json = await res.json() as { data: T };
  return json.data;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${getBaseURL()}${path}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${getBaseURL()}${path}`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Upload error: ${res.status}`);
  const json = await res.json() as { data: T };
  return json.data;
}
