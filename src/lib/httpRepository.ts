import { API_BASE_URL } from './apiConfig';
import { backendErrorMessage } from '../features/newsFeed/backendError';
import { getAuthToken } from './tokenStore';

/**
 * Every feature's data repository, talking to dock-helper-api over HTTP. `update(id, payload)`
 * takes a plain partial payload rather than an updater function — that can't cross an HTTP
 * boundary — so call sites build the full replacement themselves instead of fetch-then-merge.
 * The server generates `id` (and any timestamps) on create, so `TCreate` never includes it.
 */
export interface HttpRepository<T, TCreate, TUpdate = Partial<TCreate>> {
  list(): Promise<T[]>;
  create(payload: TCreate): Promise<T>;
  update(id: string, payload: TUpdate): Promise<T>;
  remove(id: string): Promise<void>;
}

export class HttpRepositoryError extends Error {}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new HttpRepositoryError('Не удалось подключиться к серверу.');
  }
  if (!response.ok) {
    throw new HttpRepositoryError(await backendErrorMessage(response, `Запрос не выполнен (${response.status}).`));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function createHttpRepository<T, TCreate, TUpdate = Partial<TCreate>>(
  resourcePath: string,
): HttpRepository<T, TCreate, TUpdate> {
  return {
    list: () => request<T[]>(resourcePath),

    create: (payload: TCreate) =>
      request<T>(resourcePath, { method: 'POST', body: JSON.stringify(payload) }),

    update: (id: string, payload: TUpdate) =>
      request<T>(`${resourcePath}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

    remove: (id: string) => request<void>(`${resourcePath}/${id}`, { method: 'DELETE' }),
  };
}
