import { describe, expect, it } from 'vitest';

import { derivePalette, pickHue } from './accent';
import { contrastRatio, hexToRgb, oklchToHex, rgbToOklch } from '../../lib/color/oklch';
import { BRAND_STEPS } from '../../theme';

/** Фон приложения в тёмной теме — тот же, что в accent.ts. */
const DARK_SURFACE = '#1a1b1e';

/** Тон каждые 10°: палитру строит врач своей картинкой, и проверить надо весь круг, а не образцы. */
const EVERY_HUE = Array.from({ length: 36 }, (_, i) => i * 10);

function colourAtHue(hue: number, chroma = 0.16): string {
  return oklchToHex({ l: 0.62, c: chroma, h: hue });
}

describe('derivePalette', () => {
  it('на всяком тоне держит белый текст на заливке читаемым', () => {
    const bad = EVERY_HUE.map((hue) => ({ hue, ratio: contrastRatio('#ffffff', derivePalette(colourAtHue(hue))[6]) })).filter(
      (row) => row.ratio < 4.5,
    );
    expect(bad).toEqual([]);
  });

  it('на всяком тоне держит читаемым и наведённое состояние кнопки', () => {
    for (const hue of EVERY_HUE) {
      const palette = derivePalette(colourAtHue(hue));
      for (const step of [7, 8, 9]) {
        expect(contrastRatio('#ffffff', palette[step])).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('на всяком тоне держит акцентный текст читаемым на тёмном фоне', () => {
    const bad = EVERY_HUE.map((hue) => ({ hue, ratio: contrastRatio(DARK_SURFACE, derivePalette(colourAtHue(hue))[4]) })).filter(
      (row) => row.ratio < 4.5,
    );
    expect(bad).toEqual([]);
  });

  it('оставляет ступени по возрастанию темноты — палитра не должна перевернуться', () => {
    for (const hue of EVERY_HUE) {
      const lightness = derivePalette(colourAtHue(hue)).map((step) => rgbToOklch(hexToRgb(step)).l);
      for (let i = 1; i < lightness.length; i++) {
        expect(lightness[i]).toBeLessThan(lightness[i - 1]);
      }
    }
  });

  it('на фирменном синем повторяет фирменную палитру почти дословно', () => {
    // Профиль взят с неё же, поэтому расхождение должно быть в пределах округления до байта.
    const derived = derivePalette(BRAND_STEPS[6]);
    for (let i = 0; i < derived.length; i++) {
      expect(contrastRatio(derived[i], BRAND_STEPS[i])).toBeLessThan(1.12);
    }
  });

  it('блёклый цвет даёт спокойную палитру, но не серую', () => {
    const pale = derivePalette(oklchToHex({ l: 0.62, c: 0.01, h: 30 }));
    const chroma = rgbToOklch(hexToRgb(pale[6])).c;
    const brandChroma = rgbToOklch(hexToRgb(BRAND_STEPS[6])).c;
    expect(chroma).toBeGreaterThan(brandChroma * 0.3);
    expect(chroma).toBeLessThan(brandChroma * 0.6);
  });
});

/** Собирает «картинку» из перечисленных цветов, по `repeat` пикселей на каждый. */
function pixels(colours: [number, number, number][], repeat: number): number[] {
  const out: number[] = [];
  for (const [r, g, b] of colours) for (let i = 0; i < repeat; i++) out.push(r, g, b, 255);
  return out;
}

describe('pickHue', () => {
  it('на чёрно-белой картинке не выбирает ничего', () => {
    const data = pixels(
      [
        [20, 20, 20],
        [128, 128, 128],
        [240, 240, 240],
      ],
      100,
    );
    expect(pickHue(data, data.length / 4)).toBeNull();
  });

  it('берёт господствующий тон, а не среднее по картинке', () => {
    // Половина закатно-оранжевого, половина морского синего: среднее — грязно-серое,
    // которого на картинке нет ни в одной точке.
    const data = pixels(
      [
        [230, 120, 40],
        [40, 90, 200],
      ],
      100,
    );
    const picked = pickHue(data, data.length / 4);
    expect(picked).not.toBeNull();
    const chroma = rgbToOklch(hexToRgb(picked as string)).c;
    expect(chroma).toBeGreaterThan(0.06);
  });

  it('небольшое яркое пятно перевешивает поле бледного', () => {
    // Восемьдесят пикселей почти-серого против двадцати насыщенно-красных: голос весит насыщенностью.
    const data = [...pixels([[200, 195, 190]], 80), ...pixels([[230, 30, 30]], 20)];
    const picked = pickHue(data, data.length / 4);
    expect(picked).not.toBeNull();
    const hue = rgbToOklch(hexToRgb(picked as string)).h;
    expect(hue).toBeGreaterThan(10);
    expect(hue).toBeLessThan(60);
  });
});
