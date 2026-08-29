import { useEffect } from 'react';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { DEFAULT_NEWS_SOURCES } from './types';
import type { NewsFeedSource } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['news-feed-sources'];
const resource = createCrudResource<NewsFeedSource, { url: string; title: string }>('/news-feed-sources', QUERY_KEY);

/**
 * The backend doesn't seed default sources (unlike knowledge base/calculators/analyzer), and its
 * ids are server-generated UUIDs rather than the fixed ids `DEFAULT_NEWS_SOURCES` used to rely on
 * under localStorage — so this seeds by matching on `url` instead, which is the only field both
 * sides agree is stable. Guarded by its own flag so it only ever runs once per browser; safe even
 * if re-run (e.g. from a second browser against the same backend account) since it only creates
 * defaults whose url isn't already present.
 *
 * **Засев идёт только по удавшейся загрузке, и это не перестраховка.** Раньше он запускался по
 * `isLoading === false`, а это состояние наступает и при ошибке запроса: список тогда пуст не
 * потому, что лент нет, а потому, что их не спросили. Дальше «которых ещё нет» верно для всех шести
 * — и в базу уезжают дубликаты уже существующих лент. Воспроизведено на стенде: ограничитель в
 * 20 запросов в минуту (страница новостей сама тянет шесть лент) отдал 429, и после пяти открытий
 * в чистом браузере в рабочем пространстве стало тридцать источников вместо шести, а каждая новость
 * показывалась по пять раз.
 *
 * Отметка ставится **после** успешного засева, а не до: сорвавшийся засев должен повториться, иначе
 * браузер останется без лент навсегда. От повторного запуска двумя копиями хука (страница новостей
 * и карточка дашборда монтируются вместе) защищает `seeding` — обещание на весь модуль.
 */
const MIGRATION_FLAG_KEY = 'medassist:news-sources:seeded-defaults-v3';

/** Засев уже идёт: второй копии хука ждать его, а не начинать свой. */
let seeding: Promise<void> | null = null;

async function seedDefaultSources(current: NewsFeedSource[]): Promise<void> {
  const existingUrls = new Set(current.map((s) => s.url));
  for (const source of DEFAULT_NEWS_SOURCES) {
    if (!existingUrls.has(source.url)) await resource.repo.create({ url: source.url, title: source.title });
  }
}

export function useNewsFeedSources() {
  const { items: sources, isLoading, isSuccess, error, refetch, invalidate, create, update, remove } =
    useCrudResource(resource);

  useEffect(() => {
    if (!isSuccess || seeding || localStorage.getItem(MIGRATION_FLAG_KEY)) return;
    seeding = seedDefaultSources(sources)
      .then(() => {
        localStorage.setItem(MIGRATION_FLAG_KEY, '1');
        invalidate();
      })
      .finally(() => {
        seeding = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuccess, sources]);

  return {
    sources,
    isLoading,
    error,
    refetch,
    addSource: (input: { url: string; title: string }) => create({ url: input.url.trim(), title: input.title.trim() }),
    renameSource: (id: string, title: string) => update(id, { title }),
    removeSource: remove,
  };
}
