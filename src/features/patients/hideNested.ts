import type { DispensaryRecord, Patient } from './types';

/**
 * Hiding a record that is not a row of its own list.
 *
 * A visit lives inside its patient and an observation inside its card of account, so the cache holds
 * the parent and the generic «drop the row with this id» cannot reach either. These rebuild the
 * parent without the child, which is what lets the undo window work the same way for them as for
 * everything else.
 */

/**
 * Визит прячется из кэша **одной записи**, а не из списка картотеки.
 *
 * Список визитов больше не возит вовсе (`usePatients` отдаёт сводки), поэтому раньше окно отмены
 * оставляло бы удалённый визит на экране до ответа сервера: в списке его нет, а карточка читает
 * свой кэш `['patients', id]`.
 */
export function hideVisit(visitId: string) {
  return (cached: unknown): unknown => {
    const patient = cached as Patient | undefined;
    if (!patient?.visits) return cached;
    return { ...patient, visits: patient.visits.filter((visit) => visit.id !== visitId) };
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
