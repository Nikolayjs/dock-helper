import { API_BASE_URL } from './apiConfig';
import { backendErrorMessage } from '../features/newsFeed/backendError';
import { isDemoSession } from '../features/demo/demoSession';
import { getAuthToken, reportSessionExpired } from './tokenStore';

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

/**
 * `expectedUnauthorized` marks the one call where a 401 is an answer, not an expired session:
 * changing the password returns 401 when the *current* password is wrong (`auth.service.ts`), and
 * treating that as a dead session would log a doctor out over a typo.
 */
export async function request<T>(
  path: string,
  init?: RequestInit,
  { expectedUnauthorized = false }: { expectedUnauthorized?: boolean } = {},
): Promise<T> {
  // Демо-режим подменяется здесь, и это единственное место на всё приложение: через `request`
  // ходят и все репозитории, и два десятка отдельных вызовов вроде визитов пациента или отметки
  // калькулятора избранным. Импорт динамический — выдуманная картотека не должна лежать в чанке,
  // который скачивает каждый настоящий врач.
  if (isDemoSession()) {
    const { demoRequest } = await import('../features/demo/demoApi');
    try {
      return await demoRequest<T>(path, init);
    } catch (error) {
      // Наружу уходит та же ошибка, что и от сервера: вызывающий код не должен знать про демо.
      throw new HttpRepositoryError(error instanceof Error ? error.message : 'В демо-режиме это действие недоступно.');
    }
  }

  const token = getAuthToken();
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        // A FormData body must NOT get an explicit Content-Type: the browser has to set it
        // itself so it can append the multipart boundary. Forcing application/json here makes
        // the server parse a file upload as JSON and reject it.
        ...(init?.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new HttpRepositoryError('Не удалось подключиться к серверу.');
  }
  if (!response.ok) {
    if (response.status === 401 && !expectedUnauthorized) reportSessionExpired();
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
