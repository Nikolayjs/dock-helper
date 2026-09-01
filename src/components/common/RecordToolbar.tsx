import type { ReactNode } from 'react';
import { Group } from '@mantine/core';

import { BackButton } from './BackButton';
import type { BackTarget } from '../../lib/backTarget';
import { PageToolbar } from './PageToolbar';

/**
 * Верхушка страницы одной записи: возврат слева, действия над записью справа.
 *
 * Тот же блок, что `PageToolbar` у раздела, и по той же причине: строка «← К списку · Удалить ·
 * Печать · Редактировать» лежала прямо на фоне страницы, то есть на обоях, и от раздела к разделу
 * выглядела по-разному — где-то с отступом, где-то вплотную к содержимому.
 *
 * **Действия записи и возврат — это одна полоса управления, а не две группы кнопок.** Разделять их
 * незачем: обе про эту страницу, и обе исчезают вместе с ней. Так же устроены карточка задачи в
 * Linear и страница файла в GitHub — одна полоса сверху, содержимое под ней.
 */
interface RecordToolbarProps {
  /** Куда вернуться, если ссылка не сообщила происхождение. */
  fallback: BackTarget;
  /** Кнопки над записью: удалить, печать, редактировать. Их может не быть. */
  actions?: ReactNode;
}

export function RecordToolbar({ fallback, actions }: RecordToolbarProps) {
  return (
    <PageToolbar>
      <Group justify="space-between" wrap="wrap" gap="sm">
        <BackButton fallback={fallback} />
        {actions && (
          <Group gap="xs" wrap="wrap">
            {actions}
          </Group>
        )}
      </Group>
    </PageToolbar>
  );
}
