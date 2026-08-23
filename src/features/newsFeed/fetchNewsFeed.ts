import { API_BASE_URL } from '../../lib/apiConfig';
import { backendErrorMessage } from './backendError';
import type { NewsFeedItem, NewsFeedSource } from './types';

interface ParsedFeedItem {
  id: string;
  title: string;
  link: string;
  pubDate: string | null;
  excerpt: string;
  thumbnail?: string;
}

interface ParsedFeedResponse {
  items: ParsedFeedItem[];
  feedTitle: string | null;
}

export class NewsFeedError extends Error {}

/**
 * Fetches one RSS/Atom feed — parsed server-side by dock-helper-api (`rss-parser`, no more going
 * through the public rss2json.com) — and maps it to our own item shape, attaching this source's id
 * and title since the backend only knows the feed URL, not which locally-managed source it belongs to.
 */
export async function fetchNewsFeed(source: NewsFeedSource): Promise<{ items: NewsFeedItem[]; feedTitle: string | null }> {
  const endpoint = `${API_BASE_URL}/news-feed-sources/parse?url=${encodeURIComponent(source.url)}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch {
    throw new NewsFeedError('Не удалось загрузить ленту — проверьте подключение к интернету.');
  }

  if (!response.ok) {
    throw new NewsFeedError(await backendErrorMessage(response, `Сервис получения ленты ответил с ошибкой (${response.status}).`));
  }

  const data = (await response.json()) as ParsedFeedResponse;

  const items: NewsFeedItem[] = data.items.map((item) => ({
    ...item,
    sourceId: source.id,
    sourceTitle: source.title,
  }));

  return { items, feedTitle: data.feedTitle };
}
