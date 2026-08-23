export interface AuthUser {
  id: string;
  name: string;
  role: string;
  email: string;
  avatarDataUrl: string | null;
  signatureDataUrl: string | null;
}
