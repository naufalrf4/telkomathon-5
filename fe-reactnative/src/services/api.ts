interface ApiEnvelope<T> {
  data: T;
  message?: string;
  status?: string;
}

import { getAccessToken } from '../auth/session';

interface ApiErrorPayload {
  detail?: string;
  message?: string;
  code?: string;
  status?: string;
}

interface ApiErrorOptions {
  code?: string;
  status?: string;
  detail?: string;
  httpStatus: number;
  body?: unknown;
}

export class ApiError extends Error {
  code?: string;
  status?: string;
  detail?: string;
  httpStatus: number;
  body?: unknown;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = 'ApiError';
    this.code = options.code;
    this.status = options.status;
    this.detail = options.detail;
    this.httpStatus = options.httpStatus;
    this.body = options.body;
  }
}

declare global {
  interface Window {
    __MYDIGILEARN_API_URL__?: string;
  }
}

function getWebRuntimeBaseURL(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (window.__MYDIGILEARN_API_URL__) {
    return window.__MYDIGILEARN_API_URL__;
  }

  const queryOverride = new URLSearchParams(window.location.search).get('apiBaseUrl');
  if (queryOverride) {
    return queryOverride;
  }

  try {
    const storedOverride = window.localStorage.getItem('mydigilearn.apiBaseUrl');
    if (storedOverride) {
      return storedOverride;
    }
  } catch {
    return null;
  }

  return null;
}

export function getBaseURL(): string {
  const runtimeBaseURL = getWebRuntimeBaseURL();
  if (runtimeBaseURL) {
    return runtimeBaseURL;
  }

  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    const protocol = window.location.protocol;
    const host = window.location.host;
    return `${protocol}//${host}/api/v1`;
  }
  return '/api/v1';
}

function extractErrorPayload(payload: unknown): ApiErrorPayload | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = payload as Record<string, unknown>;

  return {
    detail: typeof candidate.detail === 'string' ? candidate.detail : undefined,
    message: typeof candidate.message === 'string' ? candidate.message : undefined,
    code: typeof candidate.code === 'string' ? candidate.code : undefined,
    status: typeof candidate.status === 'string' ? candidate.status : undefined,
  };
}

async function buildApiError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '');

  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  const parsedPayload = extractErrorPayload(payload);
  const message =
    parsedPayload?.detail ||
    parsedPayload?.message ||
    (typeof payload === 'string' && payload.trim()) ||
    `API error: ${res.status}`;

  return new ApiError(message, {
    code: parsedPayload?.code,
    status: parsedPayload?.status,
    detail: parsedPayload?.detail,
    httpStatus: res.status,
    body: payload,
  });
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getErrorMessage(
  error: unknown,
  fallback = 'Terjadi kesalahan saat memproses permintaan.'
): string {
  if (isApiError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}

async function parseResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    throw await buildApiError(res);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const json = await res.json() as ApiEnvelope<T>;
  return json.data;
}

function buildHeaders(init?: HeadersInit, includeJson = false): Headers {
  const headers = new Headers(init);
  const accessToken = getAccessToken();

  if (includeJson && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (accessToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return headers;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${getBaseURL()}${path}`, {
    headers: buildHeaders(),
  });
  return parseResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getBaseURL()}${path}`, {
    method: 'POST',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${getBaseURL()}${path}`, {
    method: 'PATCH',
    headers: buildHeaders(undefined, true),
    body: JSON.stringify(body),
  });
  return parseResponse<T>(res);
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${getBaseURL()}${path}`, {
    method: 'DELETE',
    headers: buildHeaders(),
  });
  await parseResponse<void>(res);
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${getBaseURL()}${path}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: form,
  });
  return parseResponse<T>(res);
}

export async function apiGetBlob(path: string): Promise<Blob> {
  const res = await fetch(`${getBaseURL()}${path}`, {
    headers: buildHeaders(),
  });

  if (!res.ok) {
    throw await buildApiError(res);
  }

  return res.blob();
}
