export interface NewsFeedSource {
  id: string;
  url: string;
  /** User-facing name; falls back to the feed's own channel title once fetched successfully. */
  title: string;
}

export interface NewsFeedItem {
  id: string;
  title: string;
  link: string;
  pubDate: string | null;
  excerpt: string;
  thumbnail?: string;
  sourceId: string;
  sourceTitle: string;
}

export const DEFAULT_NEWS_SOURCES: NewsFeedSource[] = [
  { id: 'vademecum', url: 'https://www.vademec.ru/rss/', title: 'Vademecum' },
  { id: 'medvestnik', url: 'https://www.medvestnik.ru/rss/news/', title: 'Медвестник' },
  { id: 'doctorpiter', url: 'https://doctorpiter.ru/rss/', title: 'ДокторПитер' },
  { id: 'medrussia', url: 'https://medrussia.org/feed/', title: 'Медицинская Россия' },
  { id: 'ria-ami', url: 'https://ria-ami.ru/feed/', title: 'РИА АМИ' },
  { id: 'gxpnews', url: 'https://gxpnews.net/feed/', title: 'GxP News' },
];
