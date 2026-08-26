import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { request } from '../../lib/httpRepository';

export const QUERY_KEY = ['news-archive-settings'];

export interface NewsArchiveSettings {
  /** Days to keep an item after publication; 0 keeps everything. */
  retentionDays: number;
}

/**
 * How long this workspace keeps news its feeds have already dropped.
 *
 * The default is ninety days — far deeper than any feed reaches on its own, and still bounded: the
 * archive lives in the same database as the patient records and is copied whole by every backup.
 */
export function useNewsArchiveSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => request<NewsArchiveSettings>('/news-feed-sources/archive-settings'),
  });

  const updateMutation = useMutation({
    mutationFn: (retentionDays: number) =>
      request<NewsArchiveSettings>('/news-feed-sources/archive-settings', {
        method: 'PATCH',
        body: JSON.stringify({ retentionDays }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
      // Shortening the window deletes on the server, so what is on screen is already out of date.
      queryClient.invalidateQueries({ queryKey: ['news-feed-items'] });
    },
  });

  return {
    retentionDays: data?.retentionDays ?? 90,
    isLoading,
    setRetentionDays: updateMutation.mutateAsync,
    isSaving: updateMutation.isPending,
  };
}
