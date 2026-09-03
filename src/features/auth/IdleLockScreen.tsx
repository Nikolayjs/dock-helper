import { useState } from 'react';
import { Box, Button, Group, PasswordInput, Stack, Text, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';

import { AuthApiError, login } from './authApi';
import { storeToken } from './session';

/**
 * Заслонка, которой закрывается приложение после бездействия.
 *
 * Рисуется **поверх** содержимого, а не вместо него: `position: fixed` на всё окно со сплошным
 * фоном. Вместо — значило бы размонтировать открытую страницу вместе с несохранённой формой, а
 * заслонка обязана быть обратимой: врач вводит пароль и продолжает с той же строки.
 *
 * Фон сплошной, а не размытый: сквозь размытие карточка пациента читается ровно настолько, чтобы
 * узнать фамилию, — а это то самое, что заслонка и закрывает.
 */
interface IdleLockScreenProps {
  username: string;
  onUnlock: () => void;
  onLogout: () => void;
}

export function IdleLockScreen({ username, onUnlock, onLogout }: IdleLockScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsChecking(true);
    try {
      // Обычный вход тем же логином: другого способа проверить пароль у сервера нет, а заодно
      // приезжает свежий токен — прежний мог протухнуть, пока экран был закрыт.
      const result = await login(username, password);
      storeToken(result.accessToken);
      setPassword('');
      onUnlock();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Не удалось разблокировать');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Box
      pos="fixed"
      inset={0}
      p="lg"
      style={{
        // Выше всего, что может быть на странице, включая модальные окна Mantine (z-index 200).
        zIndex: 3000,
        background: 'var(--mantine-color-body)',
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Stack gap="lg" maw={360} w="100%" component="form" onSubmit={submit}>
        <Stack gap={4} align="center">
          <IconLock size={32} />
          <Title order={3} ta="center">
            Приложение заблокировано
          </Title>
          <Text size="sm" c="dimmed" ta="center">
            Вы не работали некоторое время. Введите пароль, чтобы вернуться к тому, на чём остановились.
          </Text>
        </Stack>

        <PasswordInput
          label={`Пароль для ${username}`}
          value={password}
          onChange={(event) => setPassword(event.currentTarget.value)}
          error={error}
          disabled={isChecking}
          data-autofocus
          autoFocus
          required
        />

        <Group justify="space-between">
          <Button variant="subtle" color="gray" onClick={onLogout} disabled={isChecking}>
            Выйти
          </Button>
          <Button type="submit" loading={isChecking}>
            Разблокировать
          </Button>
        </Group>
      </Stack>
    </Box>
  );
}
