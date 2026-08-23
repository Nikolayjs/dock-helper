import { useQueries } from '@tanstack/react-query';

import { fetchNewsFeed } from './fetchNewsFeed';
import type { NewsFeedItem, NewsFeedSource } from './types';

const STALE_TIME_MS = 15 * 60 * 1000;

export interface SourceFeedState {
  source: NewsFeedSource;
  items: NewsFeedItem[];
  isLoading: boolean;
  isError: boolean;
  errorMessage: string | null;
  refetch: () => void;
}

export function useNewsFeedItems(sources: NewsFeedSource[]) {
  const results = useQueries({
    queries: sources.map((source) => ({
      queryKey: ['news-feed-items', source.id, source.url],
      queryFn: () => fetchNewsFeed(source),
      staleTime: STALE_TIME_MS,
    })),
  });

  const bySource: SourceFeedState[] = sources.map((source, index) => {
    const result = results[index];
    return {
      source,
      items: result.data?.items ?? [],
      isLoading: result.isLoading,
      isError: result.isError,
      errorMessage: result.error instanceof Error ? result.error.message : null,
      refetch: () => void result.refetch(),
    };
  });

  const allItems = bySource
    .flatMap((s) => s.items)
    .sort((a, b) => {
      const aTime = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const bTime = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      return bTime - aTime;
    });

  const isLoading = bySource.some((s) => s.isLoading);
  const refetchAll = () => bySource.forEach((s) => s.refetch());

  return { bySource, allItems, isLoading, refetchAll };
}
