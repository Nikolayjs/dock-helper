import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  CopyButton,
  Divider,
  Group,
  List,
  Loader,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBrowserPlus, IconCheck, IconCopy, IconPlugConnected, IconTrash } from '@tabler/icons-react';

import { useExtensionTokens, type ExtensionScope, type ExtensionTokenView } from './useExtensionTokens';

/**
 * Что расширению позволено. Названо словами врача, а не идентификаторами скоупов: «clips:write» ни
 * о чём не говорит тому, кто нажимает кнопку.
 */
const SCOPES: { value: ExtensionScope; label: string }[] = [
  { value: 'clips:write', label: 'Сохранять страницы' },
  { value: 'catalog:read', label: 'Подсказывать названия из справочников' },
];

function formatMoment(value: string | null): string {
  if (!value) return 'ни разу';
  return new Date(value).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Раздел «Расширение» в профиле врача: выпуск токена, инструкция и список активных.
 *
 * Токен показывается **один раз** — в базе лежит только его хеш, — поэтому значение не прячется в
 * подсказку и не исчезает по таймеру: пока врач его не убрал, оно на экране.
 */
export function ExtensionCard() {
  const { tokens, isLoading, issueToken, isIssuing, revokeToken } = useExtensionTokens();
  const [label, setLabel] = useState('');
  const [issued, setIssued] = useState<string | null>(null);

  const handleIssue = async () => {
    try {
      const result = await issueToken({
        label: label.trim() || 'Браузер',
        scopes: SCOPES.map((scope) => scope.value),
      });
      setIssued(result.token);
      setLabel('');
    } catch (error) {
      notifications.show({ message: error instanceof Error ? error.message : 'Не удалось выпустить токен', color: 'red' });
    }
  };

  const handleRevoke = async (token: ExtensionTokenView) => {
    try {
      await revokeToken(token.id);
      notifications.show({ message: `«${token.label}» отозван`, color: 'teal' });
    } catch (error) {
      notifications.show({ message: error instanceof Error ? error.message : 'Не удалось отозвать', color: 'red' });
    }
  };

  const active = tokens.filter((token) => !token.revokedAt);

  return (
    <Card withBorder padding="lg">
      <Group gap={8} mb={4}>
        <ThemeIcon variant="light" color="brand" size={30} radius="md">
          <IconBrowserPlus size={18} />
        </ThemeIcon>
        <Title order={4}>Расширение для браузера</Title>
      </Group>
      <Text size="sm" c="dimmed" mb="lg">
        Сохраняет статью, страницу о болезни или о препарате в один щелчок — сохранённое ждёт вас в разделе
        «Входящие», где вы решаете, куда его положить. Расширение не читает страницы в фоне и не имеет доступа
        к картотеке, диспансерному учёту и документам.
      </Text>

      <Stack gap="sm">
        <Group align="flex-end" gap="sm" wrap="wrap">
          <TextInput
            label="Название устройства"
            description="Чтобы потом понять, какой из токенов чей"
            placeholder="Ноутбук в кабинете"
            value={label}
            onChange={(event) => setLabel(event.currentTarget.value)}
            style={{ flex: '1 1 240px' }}
          />
          <Button leftSection={<IconPlugConnected size={16} />} onClick={handleIssue} loading={isIssuing}>
            Подключить браузер
          </Button>
        </Group>

        {/*
          Значение показывается один раз: в базе лежит только хеш, и второй раз его не покажет никто.
          Поэтому блок не исчезает сам — он закрывается врачом, когда тот скопировал.
        */}
        {issued && (
          <Alert color="brand" variant="light" title="Скопируйте токен — второй раз он не покажется">
            <Group gap="xs" wrap="nowrap" align="center">
              <Text
                size="sm"
                style={{ fontFamily: 'var(--mantine-font-family-monospace)', wordBreak: 'break-all', flex: 1 }}
              >
                {issued}
              </Text>
              <CopyButton value={issued}>
                {({ copied, copy }) => (
                  <Tooltip label={copied ? 'Скопировано' : 'Скопировать'}>
                    <ActionIcon variant="light" color={copied ? 'teal' : 'brand'} onClick={copy} aria-label="Скопировать токен">
                      {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
                    </ActionIcon>
                  </Tooltip>
                )}
              </CopyButton>
            </Group>
            <Text size="xs" c="dimmed" mt="sm">
              Вставьте его в настройках расширения. Если токен потеряется — выпустите новый, а этот отзовите.
            </Text>
            <Button variant="subtle" size="compact-sm" mt="xs" onClick={() => setIssued(null)}>
              Я скопировал
            </Button>
          </Alert>
        )}

        <List size="sm" spacing={4} c="dimmed">
          <List.Item>Установите расширение MedAssist Clipper в браузер.</List.Item>
          <List.Item>Откройте его настройки и вставьте туда токен.</List.Item>
          <List.Item>
            Дальше — правая кнопка на странице или выделенном тексте, «Сохранить в MedAssist».
          </List.Item>
        </List>

        <Divider my="xs" />

        {isLoading ? (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="sm" c="dimmed">
              Загружаем подключения…
            </Text>
          </Group>
        ) : tokens.length === 0 ? (
          <Text size="sm" c="dimmed">
            Пока ни один браузер не подключён.
          </Text>
        ) : (
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Подключено браузеров: {active.length}
            </Text>
            {tokens.map((token) => (
              <Group key={token.id} justify="space-between" wrap="nowrap" gap="sm">
                <div style={{ minWidth: 0 }}>
                  <Group gap={6} wrap="nowrap">
                    <Text size="sm" truncate>
                      {token.label}
                    </Text>
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
                      …{token.preview}
                    </Text>
                    {/* Отозванный остаётся в списке: «когда он перестал работать» — это то, что спрашивают. */}
                    {token.revokedAt && (
                      <Badge size="xs" color="gray" variant="light">
                        отозван {formatMoment(token.revokedAt)}
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Последний раз использован: {formatMoment(token.lastUsedAt)}
                  </Text>
                </div>
                {!token.revokedAt && (
                  <Tooltip label="Отозвать">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      radius="md"
                      aria-label={`Отозвать «${token.label}»`}
                      onClick={() => handleRevoke(token)}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            ))}
          </Stack>
        )}

        <Text size="xs" c="dimmed">
          Смена пароля и «Выйти на всех устройствах» отзывают все подключения — расширение попросит подключиться
          заново. Токен не даёт доступа к пациентам: он умеет только приносить страницы во{' '}
          <Anchor href="/app/inbox" size="xs">
            «Входящие»
          </Anchor>
          .
        </Text>
      </Stack>
    </Card>
  );
}
