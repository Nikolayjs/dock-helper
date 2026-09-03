import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * В бою `/manifest.webmanifest` отдаёт бэкенд, подставляя `theme_color` из куки (см. `index.html`).
 * У dev-сервера бэкенда нет, и без этого адрес отвечал бы 404 — то есть приложение в dev нельзя
 * было бы установить. Заготовка отдаётся как есть.
 */
function manifestInDev(): Plugin {
  return {
    name: 'medassist-manifest-in-dev',
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => {
        res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
        res.end(readFileSync('public/manifest.template.json'))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), manifestInDev()],
  build: {
    // Нужен пререндеру: по нему он находит файл стилей публичной части и подключает его прямо в
    // готовый HTML. Без этого страница из `curl` приезжала бы без единого правила — стили у нас
    // грузит загрузчик чанков, то есть уже javascript.
    manifest: true,
    rollupOptions: {
      output: {
        // React и роутер вынесены в отдельный чанк: его имя содержит отпечаток содержимого, и
        // правка нашего кода этот отпечаток не меняет — браузер берёт его из кэша через деплой.
        // Раньше они лежали во входном чанке и переезжали заново при каждом релизе.
        //
        // Mantine сюда сознательно **не** попала. Её компоненты делятся между двумя корнями —
        // лендингом и приложением, — и общий вендорный чанк отдал бы лендингу всю библиотеку
        // целиком вместо тех двух десятков компонентов, которые он показывает. Замер: с группой
        // `@mantine/*` лендинг вырастал со 122 до 263 КБ gzip.
        codeSplitting: {
          groups: [
            {
              name: 'vendor-react',
              test: /node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
            },
          ],
        },
      },
    },
  },
})
