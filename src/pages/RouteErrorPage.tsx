import { Button, Card, Code, Group, Spoiler, Stack, Text, Title } from '@mantine/core';
import { IconRefresh } from '@tabler/icons-react';
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom';

/**
 * Экран для исключения, вылетевшего со страницы приложения.
 *
 * Стоит на безымянном маршруте **внутри** `AppLayout`, а не над ним, и это главное в нём: ошибка
 * заменяет собой содержимое страницы, а шапка и сайдбар остаются на месте. Иначе одна упавшая
 * страница уносит с собой всю навигацию, и уйти с неё можно только перезагрузкой.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const navigate = useNavigate();

  const details = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <Card withBorder padding="xl" radius="lg" maw={640} mx="auto" mt="xl">
      <Stack gap="md">
        <Title order={3}>Страница не открылась</Title>
        <Text c="dimmed">
          Что-то пошло не так при её отрисовке. Данные не потеряны — они на сервере. Можно вернуться
          к другому разделу или перезагрузить страницу.
        </Text>
        <Spoiler maxHeight={0} showLabel="Подробности ошибки" hideLabel="Скрыть подробности">
          <Code block>{details}</Code>
        </Spoiler>
        <Group>
          <Button leftSection={<IconRefresh size={16} />} onClick={() => window.location.reload()}>
            Перезагрузить страницу
          </Button>
          <Button variant="default" onClick={() => navigate('/dashboard')}>
            На дашборд
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}
