import { useMemo } from 'react';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { QUERY_KEY as DRUGS_QUERY_KEY } from './useDrugs';

export interface DrugCategory {
  id: string;
  name: string;
  position: number;
  /** Непусто у разделов, пришедших со сборкой. Пусто — раздел завёл врач. */
  seedKey: string;
}

export const QUERY_KEY = ['drug-categories'];

// Переименование раздела меняет поле `category` у препаратов — список на экране уже устарел.
const resource = createCrudResource<DrugCategory, { name: string; position?: number }>(
  '/drug-categories',
  QUERY_KEY,
  { alsoInvalidate: [DRUGS_QUERY_KEY] },
);

/**
 * Разделы справочника препаратов.
 *
 * Раньше это была константа, вшитая одинаково в бэкенд и во фронт: раздел нельзя было ни добавить,
 * ни переименовать. Теперь это обычные строки в базе, а одиннадцать исходных приходят из сида.
 *
 * Переименование раздела перекладывает карточки на бэкенде — `drugs.category` хранит само название,
 * — поэтому после него список препаратов тоже нужно перечитать.
 */
export function useDrugCategories() {
  const { items, isLoading, error, refetch, create, update, remove } = useCrudResource(resource);

  const sorted = useMemo(() => [...items].sort((a, b) => a.position - b.position), [items]);
  const names = useMemo(() => sorted.map((c) => c.name), [sorted]);

  return {
    categories: sorted,
    names,
    isLoading,
    error,
    refetch,
    addCategory: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return '';
      const created = await create({ name: trimmed });
      return created.name;
    },
    renameCategory: ({ id, name }: { id: string; name: string }) => update(id, { name: name.trim() }),
    removeCategory: remove,
  };
}
