import { Avatar, Group, Text, Tooltip } from '@mantine/core';

import { initialsOf } from '../workspace/useWorkspaceMembers';
import type { WorkspaceMember } from '../workspace/workspaceApi';

/**
 * Подпись на карточке: кто за ней стоит.
 *
 * Показывается исполнитель, а если его нет — тот, кто карточку завёл. Это две разные вещи, и
 * различает их подсказка: «взялся» и «завёл» на доске означают разное, а места под обе подписи
 * сразу на карточке нет.
 *
 * Пусто — тоже ответ: карточка, которую ещё никто не взял, нормальное состояние доски, и рисовать
 * там пустой кружок значило бы намекать на потерю.
 */
interface MemberSignatureProps {
  member: WorkspaceMember | null;
  /** `assignee` — взялся за работу, `author` — завёл карточку. */
  kind: 'assignee' | 'author';
  showName?: boolean;
}

export function MemberSignature({ member, kind, showName = false }: MemberSignatureProps) {
  if (!member) return null;

  const label = kind === 'assignee' ? `Взялся: ${member.name}` : `Завёл: ${member.name}`;

  return (
    <Tooltip label={label} withArrow>
      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
        <Avatar
          src={member.avatarDataUrl ?? undefined}
          size={20}
          radius="xl"
          // У исполнителя подпись заметнее: он про то, что происходит сейчас, а автор — про историю.
          color={kind === 'assignee' ? 'brand' : 'gray'}
          variant={kind === 'assignee' ? 'filled' : 'light'}
        >
          <Text size="9px" fw={700}>
            {initialsOf(member.name)}
          </Text>
        </Avatar>
        {showName && (
          <Text size="xs" c="dimmed" truncate>
            {member.name}
          </Text>
        )}
      </Group>
    </Tooltip>
  );
}
