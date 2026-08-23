import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Container size="sm" px={0}>
      <Stack align="center" gap="sm" py={100}>
        <Title order={1} fz={64}>
          404
        </Title>
        <Text c="dimmed">Такой страницы не существует.</Text>
        <Button mt="md" onClick={() => navigate('/dashboard')}>
          На дашборд
        </Button>
      </Stack>
    </Container>
  );
}
