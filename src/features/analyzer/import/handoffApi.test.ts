import { afterEach, describe, expect, it, vi } from 'vitest';

import { HandoffError, takeHandoffFile, takeHandoffOnce } from './handoffApi';

/** Ответ слота: файл с именем в заголовке — по нему `labFileText` отличает PDF от снимка. */
function slotResponds(body = 'PDF', name = 'анализы.pdf') {
  const spy = vi.fn(
    async () =>
      new Response(body, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
        },
      }),
  );
  vi.stubGlobal('fetch', spy);
  return spy;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('файл из промежуточного слота', () => {
  it('приезжает файлом с именем из заголовка', async () => {
    slotResponds();
    const file = await takeHandoffFile('slot-name');
    expect(file.name).toBe('анализы.pdf');
    expect(file.type).toBe('application/pdf');
  });

  /*
   * Слот отдаётся один раз, поэтому второй запрос за тем же файлом — не повтор, а гарантированная
   * ошибка. Страницу же есть чему пересобрать, и без памяти на модуле окно разбора закрывалось бы
   * сразу после того, как открылось.
   */
  it('за одним слотом ходят ровно один раз', async () => {
    const fetchSpy = slotResponds();

    const [first, second] = await Promise.all([takeHandoffOnce('slot-once'), takeHandoffOnce('slot-once')]);
    const third = await takeHandoffOnce('slot-once');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it('за разными слотами ходят по разу за каждым', async () => {
    const fetchSpy = slotResponds();
    await takeHandoffOnce('slot-a');
    await takeHandoffOnce('slot-b');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  /*
   * «Уже забрали», «прошло десять минут» и «слот чужой» сервер не различает намеренно, и врачу они
   * тоже про одно: отправить заново. Поэтому у 404 свой текст, а не «Запрос не выполнен (404)».
   */
  it('исчезнувший слот объясняет себя и предлагает отправить заново', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    await expect(takeHandoffFile('slot-gone')).rejects.toBeInstanceOf(HandoffError);
    await expect(takeHandoffFile('slot-gone')).rejects.toThrow(/десяти минут/);
  });

  it('оборванная сеть — это не «файла нет»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network');
      }),
    );
    await expect(takeHandoffFile('slot-offline')).rejects.toThrow(/подключиться к серверу/);
  });
});
