import { Card, Container, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconHammer } from '@tabler/icons-react';

export function ComingSoonPage({ title }: { title: string }) {
  return (
    <Container size="md" px={0}>
      <Card withBorder padding="xl">
        <Stack align="center" gap="sm" py={60}>
          <ThemeIcon size={56} radius="xl" variant="light" color="brand">
            <IconHammer size={28} />
          </ThemeIcon>
          <Title order={3}>{title} — в разработке</Title>
          <Text c="dimmed" ta="center" maw={420}>
            Этот раздел появится в одном из следующих обновлений MedAssist.
          </Text>
        </Stack>
      </Card>
    </Container>
  );
}
