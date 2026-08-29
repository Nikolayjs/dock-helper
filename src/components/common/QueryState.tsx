import type { ReactNode } from 'react';
import { Alert, Button, Group, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react';

interface QueryStateProps {
  isLoading: boolean;
  error: unknown;
  /** `refetch` из хука: повтор без перезагрузки страницы. */
  onRetry: () => void;
  /** Что не загрузилось — «пациентов», «препараты»: сообщение обязано называть раздел. */
  what?: string;
  children: ReactNode;
}

/**
 * «Данные не загрузились» и «данных нет» — противоположные утверждения.
 *
 * Все списочные хуки написаны как `const { data = [], isLoading } = useQuery(...)`: `error` не
 * извлекался вовсе, и при недоступном сервере пустой массив по умолчанию рисовал «Пациентов пока
 * нет». Для картотеки это не косметика: врач видит утверждение о своих данных, которого никто не
 * проверял.
 *
 * Скелетон на время загрузки, а не спиннер: он занимает место будущего списка, и страница не
 * прыгает, когда данные приходят.
 */
export function QueryState({ isLoading, error, onRetry, what, children }: QueryStateProps) {
  if (isLoading) {
    return (
      <Stack gap="xs">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} h={44} radius="sm" />
        ))}
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertTriangle size={18} />} title={what ? `Не удалось загрузить ${what}` : 'Не удалось загрузить данные'}>
        <Stack gap="sm" align="flex-start">
          <Text size="sm">{error instanceof Error ? error.message : 'Неизвестная ошибка.'}</Text>
          <Group gap="xs">
            <Button size="compact-sm" variant="light" leftSection={<IconRefresh size={14} />} onClick={onRetry}>
              Повторить
            </Button>
          </Group>
        </Stack>
      </Alert>
    );
  }

  return <>{children}</>;
}
