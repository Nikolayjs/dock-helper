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
