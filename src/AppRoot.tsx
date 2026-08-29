import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/charts/styles.css';
import '@mantine/tiptap/styles.css';
// Наш файл — последним: он перекрывает переменные Mantine (карточка, поле ввода, подкраска обоями).
import './index.css';

import { AppearanceProvider, useAppearance } from './features/appearance/AppearanceProvider';
import { AuthProvider } from './features/auth/AuthContext';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import { queryClient } from './lib/queryClient';
import { AppRouter } from './router';

// Locale and the stylesheets above are loaded here rather than in the bootstrap: they belong to the
// application, and the public site should not pay for the editor's or the charts' styles.
dayjs.locale('ru');

export function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Снаружи `MantineProvider`: тему, перекрашенную под обои, нужно посчитать до него. */}
      <AppearanceProvider>
        <ThemedApp />
      </AppearanceProvider>
    </QueryClientProvider>
  );
}

function ThemedApp() {
  const { theme } = useAppearance();

  return (
    <MantineProvider theme={theme} defaultColorScheme="light">
      <DatesProvider settings={{ locale: 'ru' }}>
        <Notifications position="top-right" />
        <AuthProvider>
          {/* Последний рубеж: сюда попадает то, что не поймал `errorElement` маршрута, — падение
              самой оболочки или провайдера. Без него это белый лист без единого слова. */}
          <AppErrorBoundary>
            <AppRouter />
          </AppErrorBoundary>
        </AuthProvider>
      </DatesProvider>
    </MantineProvider>
  );
}
