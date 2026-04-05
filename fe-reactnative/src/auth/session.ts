import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'prima.auth.accessToken';

let accessToken: string | null = null;

export function hydrateAccessToken(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return accessToken;
  }

  try {
    accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    accessToken = null;
  }

  return accessToken;
}

export function getAccessToken(): string | null {
  if (!accessToken) {
    return hydrateAccessToken();
  }

  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;

  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return;
  }

  try {
    if (token) {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } catch {
    // ignore storage failures and keep in-memory token only
  }
}
