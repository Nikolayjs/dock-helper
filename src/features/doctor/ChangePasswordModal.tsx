import { useState } from 'react';
import { Button, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { AuthApiError, changePassword } from '../auth/authApi';
import { storeToken } from '../auth/session';

/**
 * Смена пароля.
 *
 * Вынесено со страницы профиля целиком, вместе с состоянием: шесть переменных, из которых пять
 * очищаются при закрытии, странице профиля не нужны ни разу. Единственное, что она о них знала, —
 * это кнопка, которая открывает окно.
 *
 * **Ошибка показывается в окне, а не тостом.** Неверный текущий пароль — это ответ формы, и ответ
 * должен стоять рядом с полем, а не улетать в угол экрана. По той же причине 401 отсюда не гасит
 * сессию: это ответ про опечатку, а не про протухший токен (см. `expectedUnauthorized`).
 */
interface ChangePasswordModalProps {
  opened: boolean;
  onClose: () => void;
}

export function ChangePasswordModal({ opened, onClose }: ChangePasswordModalProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const close = () => {
    onClose();
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setError(null);
  };

  const handleSave = async () => {
    setError(null);
    if (newPassword !== confirmNewPassword) {
      setError('Новые пароли не совпадают.');
      return;
    }
    setIsSaving(true);
    try {
      // Сервер отзывает все сессии и присылает новый токен для этой: без замены следующий же
      // запрос из этой вкладки получил бы 401 и выбросил на вход того, кто пароль и менял.
      const { accessToken } = await changePassword(currentPassword, newPassword);
      storeToken(accessToken);
      notifications.show({ message: 'Пароль изменён, остальные устройства разлогинены', color: 'teal' });
      close();
    } catch (err) {
      setError(err instanceof AuthApiError ? err.message : 'Не удалось сменить пароль');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal opened={opened} onClose={close} title="Сменить пароль" radius="lg" centered>
      <Stack gap="md">
        {error && (
          <Text size="sm" c="red">
            {error}
          </Text>
        )}
        <PasswordInput
          label="Текущий пароль"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.currentTarget.value)}
          disabled={isSaving}
          required
        />
        <PasswordInput
          label="Новый пароль"
          value={newPassword}
          onChange={(e) => setNewPassword(e.currentTarget.value)}
          disabled={isSaving}
          required
        />
        <PasswordInput
          label="Повторите новый пароль"
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.currentTarget.value)}
          disabled={isSaving}
          required
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close} disabled={isSaving}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={!currentPassword || !newPassword || !confirmNewPassword}
          >
            Сохранить
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
