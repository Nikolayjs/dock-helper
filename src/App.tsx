import { MantineProvider } from '@mantine/core';
import { DatesProvider } from '@mantine/dates';
import { Notifications } from '@mantine/notifications';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './features/auth/AuthContext';
import { DeleteConfirmProvider } from './features/deletion/DeleteConfirmProvider';
import { queryClient } from './lib/queryClient';
import { theme } from './theme';
import { AppRouter } from './router';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <DatesProvider settings={{ locale: 'ru' }}>
          <Notifications position="top-right" />
          <AuthProvider>
            <BrowserRouter>
              {/* Inside the router: a deletion started on a record's own page keeps its undo
                  window while the app navigates back to the list. */}
              <DeleteConfirmProvider>
                <AppRouter />
              </DeleteConfirmProvider>
            </BrowserRouter>
          </AuthProvider>
        </DatesProvider>
      </MantineProvider>
    </QueryClientProvider>
  );
}
