import { useQueryClient } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';

import { isDemoSession } from '../demo/demoSession';
import { getMemberships, switchWorkspace, type WorkspaceMembership } from './workspaceApi';

export const WORKSPACES_QUERY_KEY = ['workspace', 'memberships'];

/**
 * Рабочие пространства врача и переключение между ними.
 *
 * В демо запроса нет вовсе: гостевая сессия работает без сервера, и пространство у неё одно —
 * та же причина, по которой в ней нет ни приглашения, ни смены пароля.
 */
export function useWorkspaces() {
  const queryClient = useQueryClient();
  const demo = isDemoSession();

  const { data = [], isPending } = useQuery({
    queryKey: WORKSPACES_QUERY_KEY,
    queryFn: getMemberships,
    enabled: !demo,
  });

  /**
   * Переключение сбрасывает **весь** кэш, а не отдельные ключи.
   *
   * За `['patients']` и полусотней других ключей теперь стоят записи другой клиники, и точечная
   * инвалидация означала бы перебрать их все — то есть однажды один забыть и показать врачу чужую
   * картотеку под видом своей. Сброс целиком проще и не ошибается.
   */
  const switchTo = async (workspaceId: string) => {
    await switchWorkspace(workspaceId);
    await queryClient.resetQueries();
  };

  return { workspaces: data as WorkspaceMembership[], isLoading: !demo && isPending, switchTo };
}
