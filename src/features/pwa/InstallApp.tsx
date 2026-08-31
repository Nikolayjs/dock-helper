import { useSyncExternalStore } from 'react';
import { Alert, Button, Card, Group, List, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCircleCheck, IconDeviceMobile, IconShare } from '@tabler/icons-react';

import {
  canInstall,
  installAdvice,
  isIos,
  isStandalone,
  promptInstall,
  subscribeToInstallState,
} from '../../lib/installPrompt';

/**
 * Установка приложения на устройство.
 *
 * Стоит рядом с настройкой уведомлений не для красоты: **на iPhone push работает только у
 * установленного приложения**, и без этой карточки требование осталось бы написанным мелким шрифтом
 * в чужой документации.
 *
 * Три разных состояния, и это не одна кнопка с разными подписями: установленному приложению нечего
 * предлагать, у Chrome установка делается одним нажатием, а на iOS её нет вовсе — там есть только
 * инструкция, и она обязана быть точной, иначе бесполезна.
 */
export function InstallApp() {
  const installable = useSyncExternalStore(subscribeToInstallState, canInstall, () => false);
  const standalone = useSyncExternalStore(subscribeToInstallState, isStandalone, () => false);
  const advice = installAdvice({ standalone, installable, ios: isIos() });

  const install = async () => {
    const outcome = await promptInstall();
    if (outcome === 'accepted') {
      notifications.show({ message: 'Приложение установлено', color: 'teal' });
    }
  };

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb={4}>
        Приложение на устройстве
      </Title>
      <Text size="sm" c="dimmed" mb="md">
        Открывается своим окном, без адресной строки и вкладок, и запускается с рабочего стола. На
        iPhone это ещё и единственный способ получать напоминания при закрытом приложении.
      </Text>

      {advice === 'installed' ? (
        <Alert variant="light" color="teal" icon={<IconCircleCheck size={18} />}>
          Приложение уже установлено на это устройство — вы сейчас в нём.
        </Alert>
      ) : advice === 'button' ? (
        <Group>
          <Button leftSection={<IconDeviceMobile size={16} />} onClick={() => void install()}>
            Установить приложение
          </Button>
        </Group>
      ) : advice === 'ios' ? (
        /* На iOS кнопки установки не существует: Safari её не даёт никому. Остаётся инструкция —
           и она должна называть пункты меню теми же словами, что стоят на экране. */
        <Alert variant="light" color="gray" icon={<IconShare size={18} />}>
          <Text size="sm" mb={6}>
            На iPhone и iPad приложение добавляется вручную, из Safari:
          </Text>
          <List size="sm" spacing={2}>
            <List.Item>нажмите «Поделиться» — квадрат со стрелкой вверх;</List.Item>
            <List.Item>выберите «На экран „Домой“»;</List.Item>
            <List.Item>подтвердите «Добавить».</List.Item>
          </List>
        </Alert>
      ) : (
        <Alert variant="light" color="gray" icon={<IconDeviceMobile size={18} />}>
          Этот браузер не предлагает установку. Она есть в Chrome и Edge — значок установки
          появляется справа в адресной строке; в Safari на Mac это «Файл» → «Добавить в Dock».
        </Alert>
      )}
    </Card>
  );
}
