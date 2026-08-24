export interface AuthUser {
  id: string;
  name: string;
  role: string;
  username: string;
  workspaceId: string;
  avatarDataUrl: string | null;
  signatureDataUrl: string | null;
}
