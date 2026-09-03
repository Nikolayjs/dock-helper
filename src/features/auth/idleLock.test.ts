import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_IDLE_MINUTES, IDLE_LOCK_CHOICES, idleLockLabel, isIdleFor, readIdleMinutes, writeIdleMinutes } from './idleLock';

const MINUTE = 60_000;
const NOW = new Date('2026-09-03T10:00:00Z').getTime();

describe('блокировка по бездействию', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('срок', () => {
    it('по умолчанию — пятнадцать минут, и это настоящее число, а не «не задано»', () => {
      expect(readIdleMinutes()).toBe(DEFAULT_IDLE_MINUTES);
    });

    it('выбранное значение переживает перезагрузку', () => {
      writeIdleMinutes(30);
      expect(readIdleMinutes()).toBe(30);
    });

    it('ноль — это выбор «не блокировать», а не отсутствие настройки', () => {
      writeIdleMinutes(0);
      expect(readIdleMinutes()).toBe(0);
    });

    it('мусор в хранилище читается как значение по умолчанию, а не отключает блокировку', () => {
      localStorage.setItem('medassist:idle-lock-minutes', 'потом');
      expect(readIdleMinutes()).toBe(DEFAULT_IDLE_MINUTES);
      // Число не из списка — тоже: иначе правка руками отключала бы защиту молча.
      localStorage.setItem('medassist:idle-lock-minutes', '99999');
      expect(readIdleMinutes()).toBe(DEFAULT_IDLE_MINUTES);
    });
  });

  describe('isIdleFor', () => {
    it('до срока — не блокирует', () => {
      expect(isIdleFor(NOW - 14 * MINUTE, NOW, 15)).toBe(false);
    });

    it('ровно на сроке — блокирует', () => {
      expect(isIdleFor(NOW - 15 * MINUTE, NOW, 15)).toBe(true);
    });

    it('ноль минут не блокирует никогда', () => {
      expect(isIdleFor(NOW - 24 * 60 * MINUTE, NOW, 0)).toBe(false);
    });

    /* Ноутбук, закрытый на полтора часа: таймеры не шли, а время шло. */
    it('сон компьютера отсчёт не останавливает', () => {
      expect(isIdleFor(NOW, NOW + 90 * MINUTE, 15)).toBe(true);
    });
  });

  describe('подписи', () => {
    it('ноль называется словами', () => {
      expect(idleLockLabel(0)).toBe('Не блокировать');
    });

    it('у каждого варианта есть подпись, и она не пустая', () => {
      for (const minutes of IDLE_LOCK_CHOICES) expect(idleLockLabel(minutes).length).toBeGreaterThan(0);
    });
  });
});
