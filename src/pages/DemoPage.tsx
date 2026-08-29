import { useEffect } from 'react';
import { Box, Container, Loader, Stack, Text, Title } from '@mantine/core';

import { APP_BASE } from '../lib/appBase';
import { startDemoSession } from '../features/demo/demoSession';
import { LandingFooter } from '../features/landing/LandingFooter';
import { LandingHeader } from '../features/landing/LandingHeader';

/**
 * Вход в демо: отмечает гостевую сессию и уводит в приложение.
 *
 * Отдельный адрес, а не обработчик на кнопке лендинга, по двум причинам. Ссылку на демо посылают, и
 * она должна открывать демо, а не главную. И переход в приложение — это смена роутера, то есть
 * полная загрузка страницы (см. `publicRouter.tsx`): прятать её за нажатием незачем.
 */
export function DemoPage() {
  useEffect(() => {
    startDemoSession();
    window.location.replace(`${APP_BASE}/dashboard`);
  }, []);

  return (
    <>
      <LandingHeader />
      <main>
        <Box py={{ base: 48, sm: 80 }}>
          <Container size="sm">
            <Stack align="center" gap="md">
              <Loader />
              <Title order={1} fz="h3" ta="center">
                Готовим демо
              </Title>
              <Text c="dimmed" ta="center">
                Заводим вымышленную картотеку: десять пациентов, диспансерный учёт, документы и
                справочники. Ничего из этого не сохраняется.
              </Text>
            </Stack>
          </Container>
        </Box>
      </main>
      <LandingFooter />
    </>
  );
}
