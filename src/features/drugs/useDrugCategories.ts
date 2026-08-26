import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import { QUERY_KEY as DRUGS_QUERY_KEY } from './useDrugs';

export interface DrugCategory {
  id: string;
  name: string;
  position: number;
  /** Непусто у разделов, пришедших со сборкой. Пусто — раздел завёл врач. */
  seedKey: string;
}

export const QUERY_KEY = ['drug-categories'];

const repo = createHttpRepository<DrugCategory, { name: string; position?: number }>('/drug-categories');

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
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });

  const names = useMemo(
    () => [...rows].sort((a, b) => a.position - b.position).map((c) => c.name),
    [rows],
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    // Переименование раздела меняет поле category у препаратов — список на экране уже устарел.
    queryClient.invalidateQueries({ queryKey: DRUGS_QUERY_KEY });
  };

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return '';
      const created = await repo.create({ name: trimmed });
      return created.name;
    },
    onSuccess: invalidate,
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => repo.update(id, { name: name.trim() }),
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    categories: [...rows].sort((a, b) => a.position - b.position),
    names,
    isLoading,
    addCategory: addMutation.mutateAsync,
    renameCategory: renameMutation.mutateAsync,
    removeCategory: removeMutation.mutateAsync,
  };
}
