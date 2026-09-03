import { request } from '../../lib/httpRepository';

export interface WorkspaceMember {
  id: string;
  name: string;
  role: string;
  username: string;
  avatarDataUrl: string | null;
  /** Владелец пространства — тот, кто его завёл. Отмечен в списке: у него и спрашивают общее. */
  accessRole: 'owner' | 'member';
}

export function getMembers(): Promise<WorkspaceMember[]> {
  return request<WorkspaceMember[]>('/workspace/members');
}

export function invite(username: string): Promise<void> {
  return request<void>('/workspace/invite', { method: 'POST', body: JSON.stringify({ username }) });
}

/**
 * Рабочее пространство, в котором состоит врач.
 *
 * Приходит под именем `id`, а не `workspaceId`: сервер вырезает `workspaceId` из каждого ответа
 * (`StripInternalFieldsInterceptor`), и поле молча не доехало бы.
 */
export interface WorkspaceMembership {
  id: string;
  /** Название клиники из её реквизитов; пусто — врач их ещё не заполнял. */
  name: string;
  accessRole: 'owner' | 'member';
  memberCount: number;
  active: boolean;
}

export function getMemberships(): Promise<WorkspaceMembership[]> {
  return request<WorkspaceMembership[]>('/workspace/memberships');
}

export function switchWorkspace(workspaceId: string): Promise<void> {
  return request<void>(`/workspace/switch/${workspaceId}`, { method: 'POST' });
}

export function leaveWorkspace(workspaceId: string): Promise<void> {
  return request<void>(`/workspace/leave/${workspaceId}`, { method: 'POST' });
}

export function removeMember(userId: string): Promise<void> {
  return request<void>(`/workspace/members/${userId}`, { method: 'DELETE' });
}

/**
 * Как называется пространство на экране.
 *
 * Названия у пространства своего нет — им служит название клиники из реквизитов, чтобы второе имя
 * не разошлось с тем, что печатается на документах. Пока реквизиты не заполнены, называем по делу:
 * своё — «Моё пространство», общее — по числу врачей.
 */
export function workspaceLabel(membership: WorkspaceMembership): string {
  if (membership.name) return membership.name;
  if (membership.memberCount > 1) return `Общее пространство · ${membership.memberCount}`;
  return 'Моё пространство';
}
