import { defineConfig } from 'vitest/config'

/**
 * Отдельный конфиг, а не секция в `vite.config.ts`: тому нужны плагин React, пререндер и разбиение
 * чанков, а тестам — ничего из этого.
 *
 * **Окружение по умолчанию — jsdom.** До этого оно объявлялось построчным комментарием
 * `// @vitest-environment jsdom` в отдельных файлах, и забытая строка давала не отказ, а падение на
 * `document is not defined` в файле, который вчера работал. Ставить его глобально безопасно: тесты
 * без DOM от наличия `document` не меняются.
 */
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      // Считается только то, что имеет смысл держать под порогом: движки и общие помощники.
      // Страницы и формы сюда не входят — их проверяет прогон в браузере, а не покрытие.
      include: ['src/lib/**', 'src/features/analyzer/analyzerEngine.ts', 'src/features/analyzer/types.ts'],
      reporter: ['text-summary'],
      // Пороги стоят чуть ниже фактического уровня и поднимаются вместе с ним. Смысл не в цифре,
      // а в том, чтобы движок формул или разбор реестра нельзя было расширить, забыв про тест.
      thresholds: { statements: 80, branches: 75, functions: 75, lines: 82 },
    },
  },
})
