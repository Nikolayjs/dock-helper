import { useState } from 'react';

import type { UnsavedGuard } from './unsavedChanges';

/**
 * Сохранение, которое умеет не получиться.
 *
 * Три вещи, которые до этого делались в каждой форме по-своему или не делались вовсе: кнопка на
 * время запроса в состоянии загрузки, повторное нажатие не отправляет второй запрос, а сорвавшееся
 * сохранение возвращает охрану от ухода со страницы.
 *
 * Разрешение уйти выдаётся **до** запроса, а не после, и это не небрежность: страница уводит с себя
 * сама, внутри `onSubmit`, сразу после успешной записи — к документу, к списку, к карточке
 * пациента. Выдай его после, и собственный переход формы оказался бы заблокирован её же охраной.
 * Поэтому неудача разрешение отзывает (`rearm`).
 *
 * Тост об ошибке здесь не показывается: его показывает `mutationCache` в `queryClient.ts` — один
 * на все мутации приложения.
 */
export function useSaveAction<Args extends unknown[]>(
  /** У форм без охраны от ухода (визит, наблюдение, напоминание) её нет — и не нужно. */
  guard: Pick<UnsavedGuard, 'release' | 'rearm'> | undefined,
  submit: (...args: Args) => void | Promise<void>,
) {
  const [saving, setSaving] = useState(false);

  const save = async (...args: Args) => {
    if (saving) return;
    setSaving(true);
    guard?.release();
    try {
      await submit(...args);
    } catch {
      guard?.rearm();
    } finally {
      setSaving(false);
    }
  };

  return { saving, save };
}
