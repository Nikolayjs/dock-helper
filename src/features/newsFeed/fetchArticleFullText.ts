import { request } from '../../lib/httpRepository';

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
  // Через `request`, а не сырой `fetch`: ручка закрыта входом (сервер ходит по адресу, который
  // прислал клиент), и запрос без токена получал бы 401.
  try {
    return await request<ArticleFullText>(`/articles/full-text?url=${encodeURIComponent(url)}`);
  } catch (error) {
    throw new ArticleFullTextError(
      error instanceof Error && error.message ? error.message : 'Не удалось загрузить страницу статьи.',
    );
  }
}
