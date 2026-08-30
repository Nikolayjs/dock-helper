import { API_BASE_URL } from '../../lib/apiConfig';
import { request } from '../../lib/httpRepository';
import { backendErrorMessage } from '../newsFeed/backendError';
import type { AuthUser } from './types';

export interface AuthResult {
  accessToken: string;
  user: AuthUser;
}

export class AuthApiError extends Error {}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AuthApiError('Не удалось подключиться к серверу.');
  }
  if (!response.ok) {
    throw new AuthApiError(await backendErrorMessage(response, `Запрос авторизации не выполнен (${response.status}).`));
  }
  return (await response.json()) as T;
}

export function login(username: string, password: string): Promise<AuthResult> {
  return postJson<AuthResult>('/auth/login', { username, password });
}

export function register(username: string, password: string, name: string, role?: string): Promise<AuthResult> {
  return postJson<AuthResult>('/auth/register', { username, password, name, role });
}

export async function me(token: string): Promise<AuthUser> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new AuthApiError('Не удалось подключиться к серверу.');
  }
  if (!response.ok) {
    throw new AuthApiError(await backendErrorMessage(response, `Не удалось подтвердить сессию (${response.status}).`));
  }
  return (await response.json()) as AuthUser;
}

export type UpdateProfileInput = Partial<
  Pick<AuthUser, 'name' | 'role' | 'avatarDataUrl' | 'signatureDataUrl' | 'specialty'>
>;

/** Reuses httpRepository's `request` (bearer auth already attached) — unlike login/register/me, this only ever runs after boot, once a token is already set. */
export function updateProfile(input: UpdateProfileInput): Promise<AuthUser> {
  return request<AuthUser>('/auth/me', { method: 'PATCH', body: JSON.stringify(input) });
}

export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return request<void>(
    '/auth/me/password',
    { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) },
    // A wrong current password comes back as 401 — the one 401 that does not mean "session over".
    { expectedUnauthorized: true },
  );
}
