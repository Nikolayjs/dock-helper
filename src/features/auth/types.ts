export interface AuthUser {
  id: string;
  name: string;
  role: string;
  username: string;
  avatarDataUrl: string | null;
  signatureDataUrl: string | null;
}
