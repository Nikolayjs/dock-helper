import type { DispensaryRecord, Patient } from './types';

/**
 * Hiding a record that is not a row of its own list.
 *
 * A visit lives inside its patient and an observation inside its card of account, so the cache holds
 * the parent and the generic «drop the row with this id» cannot reach either. These rebuild the
 * parent without the child, which is what lets the undo window work the same way for them as for
 * everything else.
 */

export function hideVisit(patientId: string, visitId: string) {
  return (cached: unknown): unknown => {
    if (!Array.isArray(cached)) return cached;
    return (cached as Patient[]).map((patient) =>
      patient.id === patientId
        ? { ...patient, visits: patient.visits.filter((visit) => visit.id !== visitId) }
        : patient,
    );
  };
}

export function hideObservation(recordId: string, observationId: string) {
  return (cached: unknown): unknown => {
    if (!Array.isArray(cached)) return cached;
    return (cached as DispensaryRecord[]).map((record) =>
      record.id === recordId
        ? {
            ...record,
            observations: record.observations.filter((observation) => observation.id !== observationId),
          }
        : record,
    );
  };
}
