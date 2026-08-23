import { API_BASE_URL } from '../../lib/apiConfig';
import { backendErrorMessage } from './backendError';

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
  const endpoint = `${API_BASE_URL}/news-feed-sources/discover?url=${encodeURIComponent(url)}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch {
    throw new DiscoverFeedError('Не удалось обратиться к серверу — проверьте подключение к интернету.');
  }

  if (!response.ok) {
    throw new DiscoverFeedError(
      await backendErrorMessage(response, 'Не удалось найти RSS-ленту по этому адресу — попробуйте вставить прямую ссылку на неё.'),
    );
  }

  return (await response.json()) as DiscoveredFeed;
}
