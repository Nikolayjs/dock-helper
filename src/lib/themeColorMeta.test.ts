import { describe, expect, it } from 'vitest';

import { toHexColor } from './themeColorMeta';

describe('цвет шапки для полосы окна', () => {
  it('обычный rgb — в шестнадцатеричную запись', () => {
    expect(toHexColor('rgb(255, 255, 255)')).toBe('#ffffff');
    expect(toHexColor('rgb(36, 36, 36)')).toBe('#242424');
  });

  /* Под обоями поверхность считается через `color-mix`, и браузер отдаёт её именно так. */
  it('color(srgb …) — тоже: это то, что возвращает подкрашенная обоями шапка', () => {
    expect(toHexColor('color(srgb 0.188392 0.151333 0.137882)')).toBe('#302723');
    expect(toHexColor('color(srgb 1 1 1)')).toBe('#ffffff');
  });

  it('непрозрачность близкая к единице — всё ещё сплошной цвет', () => {
    expect(toHexColor('rgba(36, 36, 36, 1)')).toBe('#242424');
    expect(toHexColor('color(srgb 0.1 0.1 0.1 / 0.95)')).toBe('#1a1a1a');
  });

  /* Полупрозрачное системе отдавать нельзя: она нарисует сплошную полосу непонятно какого цвета. */
  it('полупрозрачное отвергается', () => {
    expect(toHexColor('rgba(0, 0, 0, 0)')).toBeNull();
    expect(toHexColor('rgba(36, 36, 36, 0.4)')).toBeNull();
    expect(toHexColor('color(srgb 0.1 0.1 0.1 / 0.5)')).toBeNull();
  });

  it('незнакомое не подставляется наугад — тогда работают меты из index.html', () => {
    expect(toHexColor('оранжевый')).toBeNull();
    expect(toHexColor('lab(50% 40 59.5)')).toBeNull();
    expect(toHexColor('')).toBeNull();
  });

  it('шестнадцатеричное пропускается как есть', () => {
    expect(toHexColor('#242424')).toBe('#242424');
    expect(toHexColor('#FFFFFF')).toBe('#ffffff');
  });
});
