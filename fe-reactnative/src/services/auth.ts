import { apiGet, apiPost } from './api';
import type { AuthUser } from '../stores/authStore';

export interface AuthSessionResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export function register(payload: RegisterPayload) {
  return apiPost<AuthSessionResponse>('/auth/register', payload);
}

export function login(payload: LoginPayload) {
  return apiPost<AuthSessionResponse>('/auth/login', payload);
}

export function getMe() {
  return apiGet<AuthUser>('/auth/me');
}
