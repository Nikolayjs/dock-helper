import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Нужен пререндеру: по нему он находит файл стилей публичной части и подключает его прямо в
    // готовый HTML. Без этого страница из `curl` приезжала бы без единого правила — стили у нас
    // грузит загрузчик чанков, то есть уже javascript.
    manifest: true,
  },
})
