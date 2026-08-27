import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { PlannerBoard, PlannerCard, PlannerColumn } from './types';

const BOARDS_KEY = ['planner-boards'];
const COLUMNS_KEY = ['planner-columns'];
const CARDS_KEY = ['planner-cards'];

export type PlannerBoardInput = { title: string; description?: string; position: number };
export type PlannerColumnInput = { boardId: string; title: string; position: number };
export type PlannerCardInput = {
  columnId: string;
  title: string;
  description?: string;
  color?: string | null;
  dueDate?: string | null;
  assigneeId?: string | null;
  position: number;
};

const boardsRepo = createHttpRepository<PlannerBoard, PlannerBoardInput>('/planner-boards');
const columnsRepo = createHttpRepository<PlannerColumn, PlannerColumnInput>('/planner-columns');
const cardsRepo = createHttpRepository<PlannerCard, PlannerCardInput>('/planner-cards');

export function usePlanner() {
  const queryClient = useQueryClient();
  const { data: boards = [], isLoading: boardsLoading } = useQuery({ queryKey: BOARDS_KEY, queryFn: boardsRepo.list });
  const { data: columns = [], isLoading: columnsLoading } = useQuery({ queryKey: COLUMNS_KEY, queryFn: columnsRepo.list });
  const { data: cards = [], isLoading: cardsLoading } = useQuery({ queryKey: CARDS_KEY, queryFn: cardsRepo.list });

  const invalidateBoards = () => queryClient.invalidateQueries({ queryKey: BOARDS_KEY });
  const invalidateColumns = () => queryClient.invalidateQueries({ queryKey: COLUMNS_KEY });
  const invalidateCards = () => queryClient.invalidateQueries({ queryKey: CARDS_KEY });

  // Заводя доску, сервер кладёт на неё колонки — поэтому обновляются оба списка сразу.
  const addBoardMutation = useMutation({
    mutationFn: (input: PlannerBoardInput) => boardsRepo.create(input),
    onSuccess: () => {
      invalidateBoards();
      invalidateColumns();
    },
  });
  const updateBoardMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<PlannerBoardInput> }) => boardsRepo.update(id, input),
    onSuccess: invalidateBoards,
  });
  // Удаление доски уносит её колонки и карточки — на экране это должно быть видно сразу.
  const deleteBoardMutation = useMutation({
    mutationFn: (id: string) => boardsRepo.remove(id),
    onSuccess: () => {
      invalidateBoards();
      invalidateColumns();
      invalidateCards();
    },
  });

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
    boards,
    columns,
    cards,
    isLoading: boardsLoading || columnsLoading || cardsLoading,

    addBoard: addBoardMutation.mutateAsync,
    renameBoard: (id: string, input: Partial<PlannerBoardInput>) => updateBoardMutation.mutateAsync({ id, input }),
    deleteBoard: deleteBoardMutation.mutateAsync,

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
