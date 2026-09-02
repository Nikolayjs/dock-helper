import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { keepRequestsAlive, request } from './httpRepository';

/**
 * Проверяется одно: **запрос, начатый при уходе со страницы, помечается `keepalive`**.
 *
 * Без этого браузер обрывал его вместе со вкладкой, и окно отмены удаления «истекало» молча:
 * запись показана удалённой, запрос не ушёл, запись на месте.
 */
describe('запросы при уходе со страницы', () => {
  const fetchMock = vi.fn(async (_input: unknown, _init?: RequestInit) => new Response(null, { status: 204 }));

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  const initOf = () => (fetchMock.mock.calls[0]?.[1] ?? {}) as RequestInit;

  it('обычный запрос идёт без keepalive', async () => {
    await request('/patients/1', { method: 'DELETE' });
    expect(initOf().keepalive).toBe(false);
  });

  it('после объявления ухода — с keepalive', async () => {
    keepRequestsAlive();
    await request('/patients/1', { method: 'DELETE' });
    expect(initOf().keepalive).toBe(true);
  });

  it('пометка не вечная: у keepalive потолок в 64 КБ, и загрузка книги не должна на него попасть', async () => {
    vi.useFakeTimers();
    keepRequestsAlive(2000);
    vi.advanceTimersByTime(2001);
    await request('/library', { method: 'POST', body: 'x' });
    expect(initOf().keepalive).toBe(false);
    vi.useRealTimers();
  });
});
