import { request } from '../../lib/httpRepository';

export interface WorkspaceMember {
  id: string;
  name: string;
  role: string;
  username: string;
  avatarDataUrl: string | null;
}

export function getMembers(): Promise<WorkspaceMember[]> {
  return request<WorkspaceMember[]>('/workspace/members');
}

export function invite(username: string): Promise<void> {
  return request<void>('/workspace/invite', { method: 'POST', body: JSON.stringify({ username }) });
}
