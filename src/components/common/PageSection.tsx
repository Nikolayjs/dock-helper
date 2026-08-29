import type { ReactNode } from 'react';
import { Card, Group, Stack, Title } from '@mantine/core';

/**
 * Раздел страницы: заголовок, действие справа и содержимое — на одной поверхности.
 *
 * До этого заголовок и пустое состояние («Пациент не состоит на диспансерном учёте») лежали прямо
 * на фоне страницы. Пока фон был серым, это читалось; с обоями под текстом оказывается фотография,
 * пусть и приглушённая подложкой. Правило в приложении одно и давно записано: содержательное — на
 * карточках, и обои его не закрывают никогда.
 *
 * Карточка на раздел, а не на каждый элемент внутри: список визитов — это уже карточки, и вкладывать
 * их в ещё одну значило бы рисовать рамку в рамке.
 */
export function PageSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card withBorder padding="lg">
      <Stack gap="md">
        <Group justify="space-between" wrap="wrap" gap="sm">
          <Title order={4}>{title}</Title>
          {action}
        </Group>
        {children}
      </Stack>
    </Card>
  );
}
