import { API_BASE_URL } from '../../lib/apiConfig';
import { backendErrorMessage } from './backendError';

export interface ArticleFullText {
  title: string | null;
  byline: string | null;
  siteName: string | null;
  /** Sanitized article HTML, safe to render with dangerouslySetInnerHTML. */
  contentHtml: string;
  textContent: string;
  /** og:image/twitter:image if present, else the first image found in the article body. */
  leadImage: string | null;
  /** Every image the article references, lead image first, absolute URLs, deduplicated. */
  images: string[];
  /** ISO 8601 timestamp from page metadata if present, else the raw date text pulled out of the article body. */
  publishedDate: string | null;
}

export class ArticleFullTextError extends Error {}

/**
 * Fetches the article's own page (RSS only ever gives a short excerpt) and asks dock-helper-api to
 * run Mozilla's Readability over it server-side to pull out the main body and its images, stripping
 * nav/ads/related-articles/etc. Being server-side, this needs no CORS proxy (the old client-only
 * implementation went through the public allorigins.win).
 */
export async function fetchArticleFullText(url: string): Promise<ArticleFullText> {
  const endpoint = `${API_BASE_URL}/articles/full-text?url=${encodeURIComponent(url)}`;

  let response: Response;
  try {
    response = await fetch(endpoint);
  } catch {
    throw new ArticleFullTextError('Не удалось загрузить страницу статьи — проверьте подключение к интернету.');
  }

  if (!response.ok) {
    throw new ArticleFullTextError(
      await backendErrorMessage(response, `Не удалось загрузить страницу статьи (${response.status}).`),
    );
  }

  return (await response.json()) as ArticleFullText;
}
