import { request } from '../../lib/httpRepository';

export interface DiscoveredFeed {
  feedUrl: string;
  title: string | null;
}

export class DiscoverFeedError extends Error {}

/**
 * Resolves whatever URL the user pastes into "add a source" — a site's homepage or a direct feed
 * link — to an actual RSS/Atom feed URL (+ a detected title), via dock-helper-api's <link
 * rel="alternate"> discovery. Lets people add a source without knowing or hunting down the raw
 * feed address themselves.
 */
export async function discoverFeed(url: string): Promise<DiscoveredFeed> {
  // Через `request`, а не сырой `fetch`: ручка закрыта входом (сервер ходит по адресу, который
  // прислал клиент), и запрос без токена получал бы 401.
  try {
    return await request<DiscoveredFeed>(`/news-feed-sources/discover?url=${encodeURIComponent(url)}`);
  } catch (error) {
    throw new DiscoverFeedError(
      error instanceof Error && error.message
        ? error.message
        : 'Не удалось найти RSS-ленту по этому адресу — попробуйте вставить прямую ссылку на неё.',
    );
  }
}
