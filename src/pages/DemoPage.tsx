import { Box, Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

import { LandingFooter } from '../features/landing/LandingFooter';
import { LandingHeader } from '../features/landing/LandingHeader';

/**
 * Placeholder for the guest session — step 5 of LANDING_TASK.md replaces this page with the real
 * demo. It exists now so the landing's main button leads somewhere that says what is going on,
 * rather than to a 404.
 */
export function DemoPage() {
  return (
    <>
      <LandingHeader />
      <main>
        <Box py={{ base: 48, sm: 80 }}>
          <Container size="sm">
            <Stack gap="md">
              <Title order={1}>Демо-режим готовим</Title>
              <Text c="dimmed">
                Скоро здесь можно будет зайти без регистрации и посмотреть MedAssist на вымышленных
                пациентах. Пока — обычный вход: аккаунт заводится за минуту.
              </Text>
              <Group mt="xs">
                <Button component={Link} to="/login">
                  Войти или зарегистрироваться
                </Button>
                <Button component={Link} to="/" variant="default">
                  На главную
                </Button>
              </Group>
            </Stack>
          </Container>
        </Box>
      </main>
      <LandingFooter />
    </>
  );
}
