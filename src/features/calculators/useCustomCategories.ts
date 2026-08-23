import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import { CALCULATOR_CATEGORIES } from './types';

interface CalculatorCategory {
  id: string;
  name: string;
  createdAt: string;
}

const QUERY_KEY = ['calculator-categories'];
const repo = createHttpRepository<CalculatorCategory, { name: string }>('/calculator-categories');

export function useCustomCategories() {
  const queryClient = useQueryClient();
  const { data: rows = [] } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const categories = useMemo(() => rows.map((c) => c.name), [rows]);

  const addCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || (CALCULATOR_CATEGORIES as readonly string[]).includes(trimmed)) return trimmed;
      const created = await repo.create({ name: trimmed });
      return created.name;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  return { categories, addCategory: addCategoryMutation.mutateAsync };
}
