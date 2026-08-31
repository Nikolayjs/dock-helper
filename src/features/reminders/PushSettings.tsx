import { useCallback, useEffect, useState } from 'react';
import { Alert, Card, Group, Loader, Stack, Switch, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBell, IconInfoCircle } from '@tabler/icons-react';

import {
  fetchPublicKey,
  getPushState,
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
  type PushState,
} from '../../lib/pushNotifications';

/** Почему переключателя нет — и что с этим делать. Каждый случай про своё, общей фразой не отделаться. */
const EXPLANATION: Record<'unsupported' | 'notConfigured' | 'blocked', string> = {
  unsupported:
    'Этот браузер не умеет фоновые уведомления. На iPhone они работают только у приложения, добавленного на домашний экран: «Поделиться» → «На экран „Домой“».',
  notConfigured:
    'На сервере не заданы ключи для уведомлений, поэтому подписаться не на что. Напоминания по-прежнему приходят в открытом приложении.',
  blocked:
    'Уведомления запрещены в настройках браузера для этого сайта. Разрешить их можно только там — из приложения это не переключается.',
};

/**
 * Уведомления на этом устройстве.
 *
 * Подписка **на устройство, а не на аккаунт**: браузер выдаёт свой адрес каждому, и на компьютере
 * и на телефоне это разные подписки. Поэтому и переключатель говорит «на этом устройстве» — иначе
 * врач, включивший его на работе, ждал бы звонка дома.
 */
export function PushSettings() {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async (key: string | null) => {
    setState(await getPushState(key));
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!isPushSupported()) {
        if (!cancelled) setState({ kind: 'unsupported' });
        return;
      }
      // Ключ спрашивается до показа переключателя: переключатель, который не может сработать, —
      // обещание без покрытия.
      const key = await fetchPublicKey().catch(() => null);
      if (cancelled) return;
      setPublicKey(key);
      await refresh(key);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const toggle = async (next: boolean) => {
    if (!publicKey) return;
    setBusy(true);
    try {
      if (next) {
        await subscribeToPush(publicKey);
        notifications.show({ message: 'Уведомления на этом устройстве включены', color: 'teal' });
      } else {
        await unsubscribeFromPush();
        notifications.show({ message: 'Уведомления на этом устройстве выключены', color: 'gray' });
      }
      await refresh(publicKey);
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : 'Не удалось изменить настройку',
        color: 'red',
      });
      await refresh(publicKey);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb={4}>
        Напоминания на этом устройстве
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Приходят, даже когда приложение закрыто. Без них напоминание срабатывает только в открытой
        вкладке — то есть тогда, когда вы и так смотрите в экран.
      </Text>

      {state === null ? (
        <Group gap="xs">
          <Loader size="xs" />
          <Text size="sm" c="dimmed">
            Проверяем настройки браузера…
          </Text>
        </Group>
      ) : state.kind === 'on' || state.kind === 'off' ? (
        <Stack gap="sm">
          <Switch
            checked={state.kind === 'on'}
            onChange={(event) => void toggle(event.currentTarget.checked)}
            disabled={busy}
            label="Присылать напоминания на это устройство"
            thumbIcon={<IconBell size={12} />}
          />
          {state.kind === 'on' && (
            <Text size="xs" c="dimmed">
              Напоминание придёт в назначенное время по часам этого устройства. Отписка снимает
              уведомления только здесь — другие устройства продолжат получать их.
            </Text>
          )}
        </Stack>
      ) : (
        <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
          {EXPLANATION[state.kind]}
        </Alert>
      )}
    </Card>
  );
}
