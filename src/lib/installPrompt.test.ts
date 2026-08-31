import { describe, expect, it } from 'vitest';

import { installAdvice, makesShortcutOnly } from './installPrompt';

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

/**
 * Кто на Android ставит приложение, а кто — ярлык.
 *
 * Разница видна только после установки: ярлык открывается вкладкой внутри своего браузера, и врач
 * остаётся гадать, почему «установленное» приложение выглядит как сайт. Сказать об этом заранее —
 * единственное, что тут вообще можно сделать со стороны сайта.
 */
describe('ярлык вместо приложения', () => {
  const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko)';

  it('Яндекс.Браузер на Android кладёт ярлык', () => {
    expect(makesShortcutOnly(`${ANDROID} Chrome/122.0.0.0 YaBrowser/24.1.0.0 Mobile Safari/537.36`)).toBe(true);
  });

  it('и другие браузеры на Chromium — тоже', () => {
    expect(makesShortcutOnly(`${ANDROID} Chrome/122.0.0.0 OPR/79.0.0.0 Mobile`)).toBe(true);
    expect(makesShortcutOnly(`${ANDROID} SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile`)).toBe(true);
  });

  // Chrome на Android собирает WebAPK — это и есть настоящая установка.
  it('Chrome на Android ставит приложение', () => {
    expect(makesShortcutOnly(`${ANDROID} Chrome/122.0.0.0 Mobile Safari/537.36`)).toBe(false);
  });

  it('к настольным браузерам это не относится', () => {
    expect(makesShortcutOnly('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 YaBrowser/24.1.0.0')).toBe(false);
  });
});
