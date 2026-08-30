/**
 * Препарат, который пациент принимает постоянно.
 *
 * Имя хранится строкой, а не ссылкой на карточку формуляра: проверка взаимодействий разрешает имена
 * сама, пациент называет торговое, а половина того, что он действительно пьёт, в формуляр не
 * попала — фитопрепараты, безрецептурные комбинации, добавки. Ссылка отсекла бы ровно их.
 */
export interface PatientMedication {
  id: string;
  patientId: string;
  name: string;
  /** Доза и режим одной строкой — «5 мг утром», «по 1 т. 2 раза в день». */
  dose: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type PatientMedicationInput = Pick<PatientMedication, 'patientId' | 'name' | 'dose' | 'note'>;
