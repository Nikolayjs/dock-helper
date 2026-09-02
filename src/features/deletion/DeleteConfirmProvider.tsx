import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { keepRequestsAlive } from '../../lib/httpRepository';
import { DeleteConfirmContext, type DeleteRequest } from './deleteConfirmContext';
import { UndoNotice } from './UndoNotice';

/**
 * One confirmation dialog and one undo window for every deletion in the app.
 *
 * Deleting used to be a single click on a small icon, with a toast afterwards that only said what
 * had already happened. This holds real patient records, so it gets both halves of the usual
 * protection: a dialog naming the record before anything happens, and a few seconds afterwards in
 * which the doctor can take it back.
 *
 * The undo is real rather than a re-creation: confirming hides the record and starts a timer, and
 * the request that actually deletes it is not sent until the timer runs out. Undoing cancels the
 * request, so the record on the server was never touched — no new id, no lost visits, nothing to
 * reconcile. Re-creating from a snapshot would have meant a different record wearing the same name.
 *
 * Both the timer and the dialog live here, at the root, so a deletion started on a record's own
 * page survives navigating away from it — which is exactly what happens when deleting a patient
 * sends you back to the list.
 */

/** How long the doctor has to take it back. Long enough to read the toast, short enough not to sit on unsent work. */
const UNDO_WINDOW_MS = 7000;

interface Pending {
  timer: ReturnType<typeof setTimeout>;
  request: DeleteRequest;
  /** The cached list as it was, so undo puts the record back on screen without waiting for a refetch. */
  snapshot: unknown;
  notificationId: string;
}

/** Removes the row with this id from a cached list, leaving anything of another shape alone. */
function removeById(cached: unknown, id: string): unknown {
  if (!Array.isArray(cached)) return cached;
  return cached.filter((item) => (item as { id?: string } | null)?.id !== id);
}

function hideFromCache(queryClient: QueryClient, request: DeleteRequest): unknown {
  const snapshot = queryClient.getQueryData(request.queryKey);
  if (request.hide) queryClient.setQueryData(request.queryKey, request.hide);
  else if (request.id) queryClient.setQueryData(request.queryKey, (old: unknown) => removeById(old, request.id!));
  return snapshot;
}

export function DeleteConfirmProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [asking, setAsking] = useState<DeleteRequest | null>(null);
  const pending = useRef(new Map<string, Pending>());
  const nextId = useRef(0);

  /** Sends the delete for real. Called by the timer, and by `flush` when the page is going away. */
  const commit = useCallback(
    async (notificationId: string) => {
      const entry = pending.current.get(notificationId);
      if (!entry) return;
      pending.current.delete(notificationId);
      clearTimeout(entry.timer);

      try {
        await entry.request.perform();
      } catch (error) {
        // The record is still there; the screen is not. Put it back and say so — a silent failure
        // here means the doctor believes something is deleted when it is not.
        queryClient.invalidateQueries({ queryKey: entry.request.queryKey });
        notifications.show({
          message: error instanceof Error ? error.message : 'Не удалось удалить запись',
          color: 'red',
        });
        return;
      }
      queryClient.invalidateQueries({ queryKey: entry.request.queryKey });
    },
    [queryClient],
  );

  const undo = useCallback(
    (notificationId: string) => {
      const entry = pending.current.get(notificationId);
      if (!entry) return;
      pending.current.delete(notificationId);
      clearTimeout(entry.timer);
      notifications.hide(notificationId);

      // The snapshot brings the row back at once; the refetch is what makes it right if anything
      // else changed in the meantime.
      queryClient.setQueryData(entry.request.queryKey, entry.snapshot);
      queryClient.invalidateQueries({ queryKey: entry.request.queryKey });
      notifications.show({ message: 'Удаление отменено', color: 'teal' });
    },
    [queryClient],
  );

  /**
   * Finishes every pending deletion now.
   *
   * A window that quietly expires when the tab is closed would leave the doctor sure they deleted
   * something that is still there. Leaving the page ends the window rather than cancelling it: the
   * deletion was already confirmed, and only the chance to take it back is lost.
   */
  const flush = useCallback(() => {
    // Запрос, начатый при закрытии вкладки, браузер обрывает вместе с ней — то есть окно отмены
    // «истекало» молча, и запись оставалась на сервере. `keepalive` доживает после закрытия.
    keepRequestsAlive();
    for (const notificationId of [...pending.current.keys()]) void commit(notificationId);
  }, [commit]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush]);

  const confirmed = useCallback(
    (request: DeleteRequest) => {
      setAsking(null);
      const notificationId = `delete-${nextId.current++}`;
      const snapshot = hideFromCache(queryClient, request);

      const timer = setTimeout(() => void commit(notificationId), UNDO_WINDOW_MS);
      pending.current.set(notificationId, { timer, request, snapshot, notificationId });

      notifications.show({
        id: notificationId,
        color: 'gray',
        autoClose: UNDO_WINDOW_MS,
        withCloseButton: false,
        message: (
          <UndoNotice
            text={request.notice}
            seconds={Math.round(UNDO_WINDOW_MS / 1000)}
            onUndo={() => undo(notificationId)}
          />
        ),
      });

      request.onConfirmed?.();
    },
    [commit, queryClient, undo],
  );

  const value = useMemo(() => (request: DeleteRequest) => setAsking(request), []);

  return (
    <DeleteConfirmContext.Provider value={value}>
      {children}
      <Modal opened={asking !== null} onClose={() => setAsking(null)} title={`Удалить ${asking?.what ?? 'запись'}?`} centered radius="md">
        <Stack gap="md">
          {asking?.name && (
            <Text fw={600} size="sm">
              {asking.name}
            </Text>
          )}
          <Text size="sm" c="dimmed">
            {asking?.alsoRemoves ? `${asking.alsoRemoves} После удаления будет несколько секунд, чтобы отменить.` : 'После удаления будет несколько секунд, чтобы отменить.'}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={() => setAsking(null)}>
              Отмена
            </Button>
            <Button color="red" onClick={() => asking && confirmed(asking)}>
              Удалить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </DeleteConfirmContext.Provider>
  );
}
