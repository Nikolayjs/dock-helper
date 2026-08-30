import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import type { PatientMedication, PatientMedicationInput } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['patient-medications'];

const resource = createCrudResource<PatientMedication, PatientMedicationInput>('/patient-medications', QUERY_KEY);

/**
 * Постоянная терапия — общим списком на рабочее пространство, как и сохранённые анализы.
 *
 * У бэкенда есть `?patientId=`, но карточка пациента и так тянет весь список пациентов, а отдельный
 * кэш на каждого означал бы новый запрос при каждом открытии карточки.
 */
export function usePatientMedications() {
  const { items, isLoading, error, refetch, create, update, remove } = useCrudResource(resource);

  return {
    medications: items,
    isLoading,
    error,
    refetch,
    addMedication: create,
    updateMedication: update,
    deleteMedication: remove,
  };
}
