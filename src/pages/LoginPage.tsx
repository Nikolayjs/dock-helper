import { useState } from 'react';
import { Alert, Anchor, Box, Button, Card, Group, Loader, PasswordInput, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconStethoscope } from '@tabler/icons-react';

import { AuthApiError, login, register } from '../features/auth/authApi';
import type { AuthUser } from '../features/auth/types';

interface LoginPageProps {
  onLoggedIn: (token: string, user: AuthUser) => Promise<void>;
}

type Mode = 'login' | 'register';

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (mode === 'register' && password !== confirmPassword) {
      setError('Пароли не совпадают.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result =
        mode === 'login' ? await login(username.trim(), password) : await register(username.trim(), password, name.trim());
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
            {mode === 'login' ? 'Вход' : 'Регистрация'}
          </Title>
          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              {error && (
                <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
                  {error}
                </Alert>
              )}
              <TextInput
                label="Логин"
                value={username}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setUsername(value);
                }}
                required
                autoFocus
                disabled={isSubmitting}
              />
              {mode === 'register' && (
                <TextInput
                  label="Имя"
                  value={name}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setName(value);
                  }}
                  required
                  disabled={isSubmitting}
                />
              )}
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
              {mode === 'register' && (
                <PasswordInput
                  label="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => {
                    const value = e.currentTarget.value;
                    setConfirmPassword(value);
                  }}
                  required
                  disabled={isSubmitting}
                />
              )}
              <Button type="submit" fullWidth mt="xs" disabled={isSubmitting} leftSection={isSubmitting ? <Loader size={16} color="white" /> : undefined}>
                {isSubmitting ? (mode === 'login' ? 'Входим…' : 'Регистрируем…') : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
              </Button>
              <Text size="sm" ta="center" c="dimmed">
                {mode === 'login' ? (
                  <>
                    Нет аккаунта?{' '}
                    <Anchor component="button" type="button" onClick={() => switchMode('register')}>
                      Зарегистрироваться
                    </Anchor>
                  </>
                ) : (
                  <>
                    Уже есть аккаунт?{' '}
                    <Anchor component="button" type="button" onClick={() => switchMode('login')}>
                      Войти
                    </Anchor>
                  </>
                )}
              </Text>
            </Stack>
          </form>
        </Card>
      </Box>
    </Stack>
  );
}
