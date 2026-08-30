export interface AuthUser {
  id: string;
  name: string;
  role: string;
  username: string;
  workspaceId: string;
  avatarDataUrl: string | null;
  signatureDataUrl: string | null;
  /**
   * `id` специальности врача или `null`, если не выбрана.
   *
   * Хранится ключ, а не название: названия специальностей мы вправе переписывать, и профиль от
   * такой правки меняться не должен.
   */
  specialty: string | null;
}
