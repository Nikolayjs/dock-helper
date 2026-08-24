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
  visits: PatientVisit[];
  createdAt: string;
  updatedAt: string;
}

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
