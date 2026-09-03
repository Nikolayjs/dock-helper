/** Куда врач собирался положить сохранённое. Меняется при правке во «Входящих». */
export type ClipTarget = 'disease' | 'drug' | 'article';

export type ClipStatus = 'draft' | 'published';

export interface Clip {
  id: string;
  target: ClipTarget;
  title: string;
  sourceUrl: string;
  siteName: string;
  byline: string;
  /** Строкой, как её нашли на странице: «2019» без месяца — это не дата, а то, что там написано. */
  publishedDate: string;
  contentHtml: string;
  excerpt: string;
  note: string;
  tags: string[];
  status: ClipStatus;
  publishedEntityId: string;
  createdAt: string;
  updatedAt: string;
}

/** Правка во «Входящих». Адреса здесь нет: он и есть личность клипа. */
export interface ClipInput {
  target?: ClipTarget;
  title?: string;
  contentHtml?: string;
  note?: string;
  tags?: string[];
}

export interface PublishClipInput {
  mode: 'create' | 'append';
  entityId?: string;
}

export const CLIP_TARGET_LABELS: Record<ClipTarget, string> = {
  article: 'Статья',
  disease: 'Заболевание',
  drug: 'Препарат',
};

/**
 * Куда ведёт опубликованный клип. Раздел у каждой цели свой, и адрес записи тоже.
 */
export function publishedHref(clip: Clip): string {
  if (clip.target === 'article') return `/articles/${clip.publishedEntityId}`;
  if (clip.target === 'disease') return `/reference/diseases/${clip.publishedEntityId}`;
  return `/drugs/${clip.publishedEntityId}`;
}
