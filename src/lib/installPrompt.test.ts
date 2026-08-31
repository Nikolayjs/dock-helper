import { describe, expect, it } from 'vitest';

import { installAdvice } from './installPrompt';

/**
 * Порядок веток в карточке установки.
 *
 * Проверяется тестом, а не браузером: настоящий iPhone не подставить, а Chromium с подменённым
 * именем всё равно предлагает установку — то есть до iOS-ветки прогон не доходит вовсе.
 */
describe('что показать в карточке установки', () => {
  it('установленному приложению — ничего не предлагаем', () => {
    expect(installAdvice({ standalone: true, installable: true, ios: false })).toBe('installed');
    expect(installAdvice({ standalone: true, installable: false, ios: true })).toBe('installed');
  });

  // Там, где браузер сам сказал «можно», инструкция была бы длиннее и хуже.
  it('когда браузер предложил установку — кнопка', () => {
    expect(installAdvice({ standalone: false, installable: true, ios: false })).toBe('button');
  });

  // На iOS событие не приходит никогда, поэтому сюда попадают ровно те, кому нужна инструкция.
  it('на iPhone без события — инструкция, а не совет про адресную строку', () => {
    expect(installAdvice({ standalone: false, installable: false, ios: true })).toBe('ios');
  });

  it('прочим браузерам — объяснение, где установка бывает', () => {
    expect(installAdvice({ standalone: false, installable: false, ios: false })).toBe('other');
  });
});
