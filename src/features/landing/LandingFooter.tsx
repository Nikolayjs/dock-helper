import { Anchor, Box, Container, Group, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';

/** TODO: подставить настоящий адрес для связи. */
const CONTACT_EMAIL = 'hello@medhelpmate.ru';

export function LandingFooter() {
  return (
    <Box
      component="footer"
      py="xl"
      mt="xl"
      style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
    >
      <Container size="lg">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Stack gap={4}>
            <Text fw={600}>MedAssist</Text>
            <Text size="sm" c="dimmed">
              Ассистент врача. {new Date().getFullYear()}
            </Text>
          </Stack>
          <Group gap="lg" wrap="wrap">
            <Anchor component={Link} to="/legal/offer" size="sm" c="dimmed" underline="never">
              Условия использования
            </Anchor>
            <Anchor component={Link} to="/legal/privacy" size="sm" c="dimmed" underline="never">
              Обработка персональных данных
            </Anchor>
            <Anchor href={`mailto:${CONTACT_EMAIL}`} size="sm" c="dimmed" underline="never">
              {CONTACT_EMAIL}
            </Anchor>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}
