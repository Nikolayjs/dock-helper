import type { AuthUser } from '../auth/types';
import type { ClinicSettings } from '../patients/clinicSettings';

/** Кто «вошёл» в демо. Вымышленный врач вымышленной поликлиники — как и всё остальное внутри. */
export const DEMO_DOCTOR: AuthUser = {
  id: 'demo-doctor',
  name: 'Ирина Соколова',
  role: 'Врач-терапевт',
  username: 'demo',
  workspaceId: 'demo-workspace',
  avatarDataUrl: null,
  signatureDataUrl: null,
  // Специальности у демо-врача нет намеренно: отбор по ней читает список с сервера, а демо
  // работает без него. Тумблера на страницах справочников в демо поэтому не будет.
  specialty: null,
  // В демо один человек, он же и владелец своего вымышленного пространства.
  accessRole: 'owner' as const,
};

/** Шапка для печатных форм: без неё бланк печатался бы без адреса и лицензии, то есть ни о чём. */
export const DEMO_CLINIC: ClinicSettings = {
  clinicName: 'Городская поликлиника № 7 (демо)',
  clinicAddress: 'г. Приморск, ул. Луговая, 12',
  licenseNumber: 'ЛО-00-01-000000 от 01.02.2024',
};
