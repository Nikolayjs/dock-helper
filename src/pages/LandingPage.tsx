import { Button, Container, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

import { APP_BASE } from '../lib/appBase';

/**
 * Placeholder. The real landing — first screen, product sections, trust, pricing, FAQ — is step 2
 * of LANDING_TASK.md; this step only opens the address to it.
 */
export function LandingPage() {
  return (
    <Container size="md" py={80}>
      <Stack gap="lg">
        <Title order={1}>MedAssist</Title>
        <Text c="dimmed">
          Пациенты, диспансерный учёт и печатные формы в одном месте — без МИС и без бумаги.
        </Text>
        <Group>
          <Button component={Link} to="/login">
            Войти
          </Button>
          <Button component="a" href={`${APP_BASE}/dashboard`} variant="light">
            Перейти в приложение
          </Button>
        </Group>
      </Stack>
    </Container>
  );
}
