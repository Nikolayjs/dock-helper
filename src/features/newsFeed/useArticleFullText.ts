import { useQuery } from '@tanstack/react-query';

import { fetchArticleFullText } from './fetchArticleFullText';

const STALE_TIME_MS = 24 * 60 * 60 * 1000;

export function useArticleFullText(url: string) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['article-full-text', url],
    queryFn: () => fetchArticleFullText(url),
    enabled: url.length > 0,
    staleTime: STALE_TIME_MS,
    retry: 1,
  });

  return {
    article: data ?? null,
    isLoading,
    isError,
    errorMessage: error instanceof Error ? error.message : null,
    refetch,
  };
}
