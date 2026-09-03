import { createCrudResource, useCrudResource, useInvalidatingMutation } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { Clip, ClipInput, PublishClipInput } from './types';

/** Кэш «Входящих». Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['clips'];

const resource = createCrudResource<Clip, ClipInput>('/clips', QUERY_KEY, {
  /*
   * Публикация заводит запись в справочнике, а не только меняет клип: список статей, нозологий или
   * формуляра, оставшийся прежним, показал бы врачу, что публикация не сработала.
   */
  alsoInvalidate: [['knowledge-documents'], ['diseases'], ['drugs']],
});

export function useClips() {
  const { items, isLoading, isSuccess, error, refetch, invalidate, update, remove } = useCrudResource(resource);

  const publish = useInvalidatingMutation(invalidate, (id: string, input: PublishClipInput) =>
    request<{ clip: Clip; entityId: string }>(`/clips/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );

  return {
    clips: items,
    isLoading,
    isSuccess,
    error,
    refetch,
    updateClip: update,
    deleteClip: remove,
    publishClip: publish,
  };
}
