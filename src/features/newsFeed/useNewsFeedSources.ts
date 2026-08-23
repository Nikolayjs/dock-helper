import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import { DEFAULT_NEWS_SOURCES } from './types';
import type { NewsFeedSource } from './types';

const QUERY_KEY = ['news-feed-sources'];
const repo = createHttpRepository<NewsFeedSource, { url: string; title: string }>('/news-feed-sources');

/**
 * The backend doesn't seed default sources (unlike knowledge base/calculators/analyzer), and its
 * ids are server-generated UUIDs rather than the fixed ids `DEFAULT_NEWS_SOURCES` used to rely on
 * under localStorage — so this seeds by matching on `url` instead, which is the only field both
 * sides agree is stable. Guarded by its own flag so it only ever runs once per browser; safe even
 * if re-run (e.g. from a second browser against the same backend account) since it only creates
 * defaults whose url isn't already present.
 */
const MIGRATION_FLAG_KEY = 'medassist:news-sources:seeded-defaults-v3';

async function seedDefaultSources(current: NewsFeedSource[]): Promise<void> {
  const existingUrls = new Set(current.map((s) => s.url));
  for (const source of DEFAULT_NEWS_SOURCES) {
    if (!existingUrls.has(source.url)) await repo.create({ url: source.url, title: source.title });
  }
}

export function useNewsFeedSources() {
  const queryClient = useQueryClient();
  const { data: sources = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  useEffect(() => {
    if (isLoading || localStorage.getItem(MIGRATION_FLAG_KEY)) return;
    localStorage.setItem(MIGRATION_FLAG_KEY, '1');
    seedDefaultSources(sources).then(invalidate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  const addSourceMutation = useMutation({
    mutationFn: (input: { url: string; title: string }) => repo.create({ url: input.url.trim(), title: input.title.trim() }),
    onSuccess: invalidate,
  });

  const renameSourceMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => repo.update(id, { title }),
    onSuccess: invalidate,
  });

  const removeSourceMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    sources,
    isLoading,
    addSource: addSourceMutation.mutateAsync,
    renameSource: (id: string, title: string) => renameSourceMutation.mutateAsync({ id, title }),
    removeSource: removeSourceMutation.mutateAsync,
  };
}
