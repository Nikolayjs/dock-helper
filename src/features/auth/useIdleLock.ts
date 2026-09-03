import { useCallback, useEffect, useRef, useState } from 'react';

import { ACTIVITY_EVENTS, isIdleFor, readIdleMinutes } from './idleLock';

/**
 * Считает бездействие и говорит, пора ли закрывать экран.
 *
 * Три решения, которые стоит помнить:
 *
 * - **Срок читается при каждом взводе таймера, а не при монтировании.** Врач меняет его в профиле,
 *   и новое значение обязано действовать сразу, а не со следующей загрузки страницы.
 * - **Таймер не перезаводится на каждое движение мыши.** События активности только пишут время в
 *   ссылку (`lastActivity`), а проверка идёт раз в 30 секунд. Слушатель, дёргающий `setTimeout` на
 *   каждый `pointermove`, — это работа на каждое движение руки; здесь же точность до полминуты
 *   никому не нужна.
 * - **Спящий компьютер отсчёт не останавливает.** Проверка сравнивает `Date.now()`, а не считает
 *   тики: ноутбук, закрытый на полтора часа, разбудит уже заблокированное приложение — таймеры в
 *   это время не идут, а время идёт.
 */
const CHECK_INTERVAL_MS = 30_000;

export function useIdleLock(enabled: boolean): { locked: boolean; unlock: () => void } {
  const [locked, setLocked] = useState(false);
  const lastActivity = useRef(Date.now());

  const unlock = useCallback(() => {
    lastActivity.current = Date.now();
    setLocked(false);
  }, []);

  useEffect(() => {
    if (!enabled || locked) return;

    const touch = () => {
      lastActivity.current = Date.now();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, touch, { passive: true, capture: true });
    }

    const tick = () => {
      if (isIdleFor(lastActivity.current, Date.now(), readIdleMinutes())) setLocked(true);
    };
    const interval = setInterval(tick, CHECK_INTERVAL_MS);
    // Возврат на вкладку — тоже повод проверить: пока она была скрыта, интервал мог не идти вовсе.
    document.addEventListener('visibilitychange', tick);

    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, touch, { capture: true });
      }
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [enabled, locked]);

  return { locked, unlock };
}
