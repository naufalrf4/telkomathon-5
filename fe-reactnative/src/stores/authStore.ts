import { create } from 'zustand';
import { getAccessToken, hydrateAccessToken, setAccessToken } from '../auth/session';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  hydrated: boolean;
  setSession: (session: { accessToken: string; user: AuthUser }) => void;
  clearSession: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: getAccessToken(),
  user: null,
  hydrated: false,
  setSession: ({ accessToken, user }) => {
    setAccessToken(accessToken);
    set({ accessToken, user, hydrated: true });
  },
  clearSession: () => {
    setAccessToken(null);
    set({ accessToken: null, user: null, hydrated: true });
  },
  hydrate: () => {
    const accessToken = hydrateAccessToken();
    set({ accessToken, hydrated: true });
  },
}));
