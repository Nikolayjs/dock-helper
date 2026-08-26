import { request } from '../../lib/httpRepository';
import type { NewsFeedItem, NewsFeedSource } from './types';

interface ArchivedFeedItem {
  id: string;
  title: string;
  link: string;
  pubDate: string | null;
  excerpt: string;
  thumbnail?: string;
}

interface ArchivedFeedResponse {
  items: ArchivedFeedItem[];
  feedTitle: string | null;
  /** The live fetch failed; what came back is history only. */
  stale: boolean;
}

export class NewsFeedError extends Error {}

/**
 * Reads one source: the backend refreshes the feed, keeps what it returned and answers with
 * everything still inside the retention window.
 *
 * This used to call the stateless `parse` endpoint and show exactly what the feed held — a window of
 * ten to a hundred items which, for a source that publishes often, is only a few days deep. An
 * archive belongs to a workspace, so the request is now authenticated and addresses the source by
 * id rather than by URL.
 */
export async function fetchNewsFeed(
  source: NewsFeedSource,
): Promise<{ items: NewsFeedItem[]; feedTitle: string | null; stale: boolean }> {
  let data: ArchivedFeedResponse;
  try {
    data = await request<ArchivedFeedResponse>(`/news-feed-sources/${source.id}/items`);
  } catch (error) {
    throw new NewsFeedError(error instanceof Error ? error.message : 'Не удалось загрузить ленту.');
  }

  // The backend knows the feed URL, not which locally-titled source it belongs to.
  const items: NewsFeedItem[] = data.items.map((item) => ({
    ...item,
    sourceId: source.id,
    sourceTitle: source.title,
  }));

  return { items, feedTitle: data.feedTitle, stale: data.stale };
}
