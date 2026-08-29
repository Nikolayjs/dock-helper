import { useQuery } from '@tanstack/react-query';

import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import { request } from '../../lib/httpRepository';
import type { Drug, DrugInput, DrugSummary } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['drugs'];

// Правка карточки меняет и её отдельный кэш, а не только строку в списке: без этого врач сразу
// после сохранения видел бы в карточке старый текст.
const resource = createCrudResource<DrugSummary, DrugInput>('/drugs', QUERY_KEY, { alsoInvalidate: [['drug']] });

/**
 * Список препаратов — без длинных текстовых полей.
 *
 * Имена нужны все и сразу: по ним ищут, по ним правило взаимодействия находит карточку по торговому
 * названию и по ним же ловится дубль МНН. А показания, дозирование и прочие простыни в списке не
 * показываются — их отдаёт `useDrug(id)` для одной карточки. Разница на нынешних 450 препаратах:
 * 128 КБ против 21 КБ в gzip, и она растёт вместе со справочником.
 */
export function useDrugs() {
  const { items, isLoading, error, refetch, create, update, remove } = useCrudResource(resource);

  return {
    drugs: items,
    isLoading,
    error,
    refetch,
    createDrug: create,
    updateDrug: update,
    deleteDrug: remove,
  };
}

/** Полная карточка одного препарата. Запрашивается только когда её действительно открывают. */
export function useDrug(id: string | undefined) {
  const { data: drug, isLoading } = useQuery({
    queryKey: ['drug', id],
    queryFn: () => request<Drug>(`/drugs/${id}`),
    enabled: Boolean(id),
  });
  return { drug, isLoading };
}
