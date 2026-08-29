import { useMemo } from 'react';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { CALCULATOR_CATEGORIES } from './types';

interface CalculatorCategory {
  id: string;
  name: string;
  createdAt: string;
}

const QUERY_KEY = ['calculator-categories'];

const resource = createCrudResource<CalculatorCategory, { name: string }>('/calculator-categories', QUERY_KEY);

export function useCustomCategories() {
  const { items, create } = useCrudResource(resource);
  const categories = useMemo(() => items.map((c) => c.name), [items]);

  return {
    categories,
    // Раздел из заводского списка уже есть — заводить его копией в базе незачем.
    addCategory: async (name: string) => {
      const trimmed = name.trim();
      if (!trimmed || (CALCULATOR_CATEGORIES as readonly string[]).includes(trimmed)) return trimmed;
      const created = await create({ name: trimmed });
      return created.name;
    },
  };
}
