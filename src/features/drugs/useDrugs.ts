import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository, request } from '../../lib/httpRepository';
import type { Drug, DrugInput, DrugSummary } from './types';

/** The cache this hook owns. Exported so a deletion can hide a row from it while its undo window is open. */
export const QUERY_KEY = ['drugs'];

const repo = createHttpRepository<DrugSummary, DrugInput>('/drugs');

/**
 * Список препаратов — без длинных текстовых полей.
 *
 * Имена нужны все и сразу: по ним ищут, по ним правило взаимодействия находит карточку по торговому
 * названию и по ним же ловится дубль МНН. А показания, дозирование и прочие простыни в списке не
 * показываются — их отдаёт `useDrug(id)` для одной карточки. Разница на нынешних 450 препаратах:
 * 128 КБ против 21 КБ в gzip, и она растёт вместе со справочником.
 */
export function useDrugs() {
  const queryClient = useQueryClient();
  const { data: drugs = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    // Правка карточки меняет и её отдельный кэш, а не только строку в списке.
    queryClient.invalidateQueries({ queryKey: ['drug'] });
  };

  const createMutation = useMutation({ mutationFn: (input: DrugInput) => repo.create(input), onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<DrugInput> }) => repo.update(id, input),
    onSuccess: invalidate,
  });
  const deleteMutation = useMutation({ mutationFn: (id: string) => repo.remove(id), onSuccess: invalidate });

  return {
    drugs,
    isLoading,
    createDrug: createMutation.mutateAsync,
    updateDrug: updateMutation.mutateAsync,
    deleteDrug: deleteMutation.mutateAsync,
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
