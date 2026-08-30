import type { Sex } from '../analyzer/types';

/**
 * Одно измерение сохранённого анализа.
 *
 * Название и единица лежат рядом со значением, а не берутся из анализатора по ключу: анализатор —
 * запись врача, его правят, переименовывают и удаляют. Результат, знающий только ключ, после
 * удаления анализатора превратился бы в набор чисел под `hgb` и `wbc`. Толкование при этом снимком
 * **не** является и считается заново по текущему анализатору — нормы ровно то, что врач исправляет.
 */
export interface LabResultValue {
  key: string;
  label: string;
  unit?: string;
  value: number;
}

/** Сохранённый в карту пациента бланк: одна панель показателей на одну дату. */
export interface LabResult {
  id: string;
  patientId: string;
  analyzerId: string;
  analyzerTitle: string;
  /** Дата самого анализа, а не сохранения: бланк приносят через несколько дней после сдачи. */
  takenAt: string;
  sex: Sex;
  /** Возраст, по которому брались нормы. Пусто — нормы взрослого, и результаты об этом говорят. */
  ageYears: number | null;
  values: LabResultValue[];
  note: string;
  createdAt: string;
  updatedAt: string;
}

export type LabResultInput = Pick<
  LabResult,
  'patientId' | 'analyzerId' | 'analyzerTitle' | 'takenAt' | 'sex' | 'ageYears' | 'values' | 'note'
>;
