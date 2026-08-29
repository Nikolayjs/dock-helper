import { Container, Stack, Text, Title } from '@mantine/core';

const TITLES = {
  offer: 'Публичная оферта',
  privacy: 'Политика обработки персональных данных',
} as const;

/** Placeholder: the texts are step 2 of LANDING_TASK.md. */
export function LegalPage({ kind }: { kind: keyof typeof TITLES }) {
  return (
    <Container size="md" py={80}>
      <Stack gap="md">
        <Title order={1}>{TITLES[kind]}</Title>
        <Text c="dimmed">Страница в работе.</Text>
      </Stack>
    </Container>
  );
}
