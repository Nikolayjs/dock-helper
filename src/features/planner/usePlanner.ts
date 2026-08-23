import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { PlannerCard, PlannerColumn } from './types';

const COLUMNS_KEY = ['planner-columns'];
const CARDS_KEY = ['planner-cards'];

export type PlannerColumnInput = { title: string; position: number };
export type PlannerCardInput = {
  columnId: string;
  title: string;
  description?: string;
  color?: string | null;
  dueDate?: string | null;
  position: number;
};

const columnsRepo = createHttpRepository<PlannerColumn, PlannerColumnInput>('/planner-columns');
const cardsRepo = createHttpRepository<PlannerCard, PlannerCardInput>('/planner-cards');

export function usePlanner() {
  const queryClient = useQueryClient();
  const { data: columns = [], isLoading: columnsLoading } = useQuery({ queryKey: COLUMNS_KEY, queryFn: columnsRepo.list });
  const { data: cards = [], isLoading: cardsLoading } = useQuery({ queryKey: CARDS_KEY, queryFn: cardsRepo.list });

  const invalidateColumns = () => queryClient.invalidateQueries({ queryKey: COLUMNS_KEY });
  const invalidateCards = () => queryClient.invalidateQueries({ queryKey: CARDS_KEY });

  const addColumnMutation = useMutation({
    mutationFn: (input: PlannerColumnInput) => columnsRepo.create(input),
    onSuccess: invalidateColumns,
  });
  const updateColumnMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PlannerColumnInput> }) => columnsRepo.update(id, input),
    onSuccess: invalidateColumns,
  });
  const deleteColumnMutation = useMutation({
    mutationFn: (id: string) => columnsRepo.remove(id),
    onSuccess: () => {
      invalidateColumns();
      invalidateCards();
    },
  });

  const addCardMutation = useMutation({
    mutationFn: (input: PlannerCardInput) => cardsRepo.create(input),
    onSuccess: invalidateCards,
  });
  const updateCardMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PlannerCardInput> }) => cardsRepo.update(id, input),
    onSuccess: invalidateCards,
  });
  const deleteCardMutation = useMutation({
    mutationFn: (id: string) => cardsRepo.remove(id),
    onSuccess: invalidateCards,
  });

  return {
    columns,
    cards,
    isLoading: columnsLoading || cardsLoading,

    addColumn: addColumnMutation.mutateAsync,
    renameColumn: (id: string, title: string) => updateColumnMutation.mutateAsync({ id, input: { title } }),
    reorderColumn: (id: string, position: number) => updateColumnMutation.mutateAsync({ id, input: { position } }),
    deleteColumn: deleteColumnMutation.mutateAsync,

    addCard: addCardMutation.mutateAsync,
    updateCard: (id: string, input: Partial<PlannerCardInput>) => updateCardMutation.mutateAsync({ id, input }),
    moveCard: (id: string, columnId: string, position: number) => updateCardMutation.mutateAsync({ id, input: { columnId, position } }),
    deleteCard: deleteCardMutation.mutateAsync,
  };
}
