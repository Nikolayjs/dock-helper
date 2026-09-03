export type ReferralCategory = 'hospitalization' | 'consultation' | 'additionalTests' | 'sanatorium' | 'other';

export interface PatientVisit {
  id: string;
  date: string;
  diagnosis: string;
  diagnosisCode?: string;
  note: string;
  referralCategory: ReferralCategory | null;
  referralDestination: string;
  createdAt: string;
}

export type PatientSex = 'male' | 'female';

export interface Patient {
  id: string;
  fullName: string;
  sex: PatientSex | null;
  birthDate: string | null;
  phone: string;
  reminderDate: string | null;
  reminderNote: string;
  /**
   * Рост и вес — и дата, когда их измерили.
   *
   * Одна дата на оба: измеряют их за один приём. Без даты вес — число, про которое неизвестно,
   * сегодняшнее оно или позапрошлогоднее, а по нему считают дозу, ИМТ и клиренс креатинина.
   */
  heightCm: number | null;
  weightKg: number | null;
  measuredAt: string | null;
  /** Свободным текстом: сюда пишут не только лекарства, но и пыльцу, латекс, йод. */
  allergies: string;
  insurancePolicy: string;
  /** Участок. */
  district: string;
  address: string;
  visits: PatientVisit[];
  createdAt: string;
  updatedAt: string;
}

/** Последний приём: то, что стоит в колонке картотеки и по чему её сортируют. */
export interface LastVisit {
  date: string;
  diagnosis: string;
  diagnosisCode?: string;
}

/**
 * Пациент в списке — **без визитов**.
 *
 * Та же пара, что у формуляра (`DrugSummary`/`Drug`) и у базы знаний: в списке сводка, полная
 * запись — по идентификатору. Причина измеренная: список отдавал все визиты всех пациентов вместе с
 * текстами приёмов — 12,0 МБ на пятистах карточках (418 КБ по сети), из них 71 % текстов, которых
 * список не показывает ни в одной колонке. Стало 335 КБ и 20 КБ по сети.
 */
export type PatientSummary = Omit<Patient, 'visits'> & {
  lastVisit: LastVisit | null;
  /** Сколько всего приёмов: окно удаления называет это число вслух. */
  visitCount: number;
};

/**
 * Визит без текста приёма — то, чем живут сводные экраны.
 *
 * Дашборд, «Мой день», поиск в шапке и отбор картотеки по диагнозу считают по всем визитам сразу, и
 * ни одному из них текст приёма не нужен — а весит он больше всего остального вместе взятого.
 */
export type VisitDigest = Omit<PatientVisit, 'note'> & { patientId: string };

/**
 * Сводка со склеенными визитами — то, что отдаёт `usePatientsWithVisits`.
 *
 * Это по-прежнему `Patient` для всех, кто считает по `patient.visits`, но с двумя полями сводки
 * сверху и **без текстов приёмов** в визитах: их не читает ни один сводный экран.
 */
export type PatientWithVisits = PatientSummary & { visits: PatientVisit[] };

/** Константы пациента: то, что измеряют и записывают один раз, а пользуются на каждом приёме. */
export type PatientConstants = Pick<
  Patient,
  'heightCm' | 'weightKg' | 'measuredAt' | 'allergies' | 'insurancePolicy' | 'district' | 'address'
>;

/**
 * С чем пациент заводится, пока ничего не измерено и не записано.
 *
 * Один набор на всех, кто собирает пациента вручную: форма, образец для предпросмотра бланка и
 * тестовые фикстуры. Иначе добавленное поле пришлось бы дописывать в семь мест — и в одном из них
 * забыть.
 */
export const EMPTY_PATIENT_CONSTANTS: PatientConstants = {
  heightCm: null,
  weightKg: null,
  measuredAt: null,
  allergies: '',
  insurancePolicy: '',
  district: '',
  address: '',
};

export type DispensaryOutcome = 'worsened' | 'improved' | 'recovered' | 'unchanged' | 'death';

export interface DispensaryObservation {
  id: string;
  date: string;
  outcome: DispensaryOutcome;
  ovl: boolean;
  sanatorium: boolean;
  campRest: boolean;
  note: string;
  createdAt: string;
}

export type DispensaryRemovalReason = 'recovered' | 'left';

export type DispensaryStatus = 'active' | 'removed';

export interface DispensaryRecord {
  id: string;
  patientId: string;
  diagnosis: string;
  diagnosisCode?: string;
  registeredDate: string;
  nextVisitDate: string | null;
  status: DispensaryStatus;
  removedDate: string | null;
  removedReason: DispensaryRemovalReason | null;
  observations: DispensaryObservation[];
  createdAt: string;
  updatedAt: string;
}
