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
  /**
   * Право распоряжаться общим: реквизитами клиники и составом рабочего пространства.
   *
   * Не то же, что `role`: та — должность, которую врач пишет себе сам и которая печатается в
   * документах. Здесь права, и их две — владелец и участник.
   */
  accessRole: 'owner' | 'member';
}
