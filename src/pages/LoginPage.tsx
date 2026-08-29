import { useState } from 'react';
import { Alert, Anchor, Box, Button, Card, Group, Loader, PasswordInput, Stack, Text, TextInput, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconStethoscope } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';

import { AuthApiError, login, register } from '../features/auth/authApi';
import { storeToken } from '../features/auth/session';
import { loginTarget } from '../lib/appBase';

type Mode = 'login' | 'register';

/**
 * The login screen is a page of the public site now, not a screen the session provider swaps in.
 *
 * It stores the token and then leaves for the application with a full page load: the workspace is
 * a different router (see `publicRouter.tsx`), so there is nothing to navigate to from here. Where
 * to go back to arrives as `?from=` — put there by the gate that turned the doctor away — and is
 * checked before use, since a query string is written by whoever wrote the link.
 */
export function LoginPage() {
  const [searchParams] = useSearchParams();
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
      storeToken(result.accessToken);
      // Not `navigate`: the application lives in another router, so this is a page load. The
      // submit button stays disabled — the browser is already leaving.
      window.location.assign(loginTarget(searchParams.get('from')));
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Не удалось подключиться к серверу.');
      setIsSubmitting(false);
    }
  };

  return (
    <Stack align="center" justify="center" mih="100vh" p="xl">
      <Box maw={380} w="100%">
        <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
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
        </Link>

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
