import { useState } from 'react';
import { Alert, Box, Button, Card, Group, Loader, PasswordInput, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconStethoscope } from '@tabler/icons-react';

import { AuthApiError, login } from '../features/auth/authApi';
import type { AuthUser } from '../features/auth/types';

interface LoginPageProps {
  onLoggedIn: (token: string, user: AuthUser) => Promise<void>;
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      await onLoggedIn(result.accessToken, result.user);
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Не удалось подключиться к серверу.');
      setIsSubmitting(false);
    }
  };

  return (
    <Stack align="center" justify="center" mih="100vh" p="xl">
      <Box maw={380} w="100%">
        <Group justify="center" mb="lg" gap={10}>
          <ThemeIcon size={44} radius="md" variant="gradient" gradient={{ from: 'brand.6', to: 'brand.8', deg: 135 }}>
            <IconStethoscope size={26} />
          </ThemeIcon>
          <div>
            <Text fw={700} size="lg" lh={1.1}>
              MedAssist
            </Text>
            <Text size="xs" c="dimmed" lh={1.1}>
              Ассистент врача
            </Text>
          </div>
        </Group>

        <Card withBorder padding="lg" radius="lg">
          <Title order={4} mb="md">
            Вход
          </Title>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {error && (
                <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
                  {error}
                </Alert>
              )}
              <TextInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setEmail(value);
                }}
                required
                autoFocus
                disabled={isSubmitting}
              />
              <PasswordInput
                label="Пароль"
                value={password}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setPassword(value);
                }}
                required
                disabled={isSubmitting}
              />
              <Button type="submit" fullWidth mt="xs" disabled={isSubmitting} leftSection={isSubmitting ? <Loader size={16} color="white" /> : undefined}>
                {isSubmitting ? 'Входим…' : 'Войти'}
              </Button>
            </Stack>
          </form>
        </Card>
      </Box>
    </Stack>
  );
}
