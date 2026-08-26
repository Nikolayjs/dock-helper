import { createContext, useContext } from 'react';
import type { QueryKey } from '@tanstack/react-query';

export interface DeleteRequest {
  /**
   * The thing being deleted, in the accusative — «пациента», «статью». Goes into «Удалить …?»,
   * because a dialog that says «Вы уверены?» tells the doctor nothing about what they clicked.
   */
  what: string;
  /** Which one exactly. A name here is what makes the dialog worth reading. */
  name?: string;
  /** What else goes with it: «Вместе с ним удалятся 4 визита». */
  alsoRemoves?: string;
  /** Past tense, for the toast: «Пациент удалён». */
  notice: string;
  /** The request that actually deletes it. Not called until the undo window closes. */
  perform: () => Promise<unknown> | unknown;
  /** The cached list the record is shown in; it is hidden there while the window is open. */
  queryKey: QueryKey;
  /** Row id, for the default hiding. Omit and pass `hide` for a record nested inside another list. */
  id?: string;
  /** Hiding for a record the default cannot reach — a visit inside its patient. */
  hide?: (cached: unknown) => unknown;
  /** Runs the moment the doctor confirms, while the record is only hidden — usually a navigation. */
  onConfirmed?: () => void;
}

export const DeleteConfirmContext = createContext<((request: DeleteRequest) => void) | null>(null);

/**
 * Asks before deleting, then gives a few seconds to take it back.
 *
 * ```ts
 * const confirmDelete = useDeleteWithConfirm();
 * confirmDelete({
 *   what: 'пациента',
 *   name: patient.fullName,
 *   notice: 'Пациент удалён',
 *   queryKey: ['patients'],
 *   id: patient.id,
 *   perform: () => deletePatient(patient.id),
 * });
 * ```
 */
export function useDeleteWithConfirm(): (request: DeleteRequest) => void {
  const ask = useContext(DeleteConfirmContext);
  if (!ask) throw new Error('useDeleteWithConfirm вне DeleteConfirmProvider');
  return ask;
}
