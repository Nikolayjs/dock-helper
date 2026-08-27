import { useQuery } from '@tanstack/react-query';

import { getMembers, type WorkspaceMember } from './workspaceApi';

const MEMBERS_KEY = ['workspace-members'];

/**
 * Кто ещё работает в этом пространстве.
 *
 * Список меняется редко — врача приглашают раз и надолго, — поэтому он держится в кеше подолгу:
 * подпись на карточке планера не повод ходить за ним на каждый рендер доски.
 */
export function useWorkspaceMembers() {
  const { data: members = [], isLoading } = useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: getMembers,
    staleTime: 10 * 60 * 1000,
  });

  return { members, isLoading };
}

/** Участник по идентификатору; `null` — если его уже нет в пространстве или подписи не было. */
export function findMember(members: WorkspaceMember[], id: string | null | undefined): WorkspaceMember | null {
  if (!id) return null;
  return members.find((member) => member.id === id) ?? null;
}

/** Инициалы для аватара без картинки: «Иван Петров» → «ИП». */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
