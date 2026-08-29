import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
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

const boardsResource = createCrudResource<PlannerBoard, PlannerBoardInput>('/planner-boards', BOARDS_KEY);
const columnsResource = createCrudResource<PlannerColumn, PlannerColumnInput>('/planner-columns', COLUMNS_KEY);
const cardsResource = createCrudResource<PlannerCard, PlannerCardInput>('/planner-cards', CARDS_KEY);

/**
 * Планер — три списка, связанные владением: доска держит колонки, колонка держит карточки.
 *
 * Чужие списки помечаются устаревшими **поимённо, а не скопом**: переименование доски колонок не
 * трогает, а её удаление уносит и колонки, и карточки. Пометить всё на всякий случай значило бы
 * перечитывать доску карточек при каждой правке названия.
 */
export function usePlanner() {
  const boards = useCrudResource(boardsResource);
  const columns = useCrudResource(columnsResource);
  const cards = useCrudResource(cardsResource);

  return {
    boards: boards.items,
    columns: columns.items,
    cards: cards.items,
    isLoading: boards.isLoading || columns.isLoading || cards.isLoading,

    // Заводя доску, сервер кладёт на неё колонки «Бэклог», «В работе», «Готово».
    addBoard: async (input: PlannerBoardInput) => {
      const board = await boards.create(input);
      columns.invalidate();
      return board;
    },
    renameBoard: boards.update,
    // Удаление доски уносит её колонки и карточки — на экране это должно быть видно сразу.
    deleteBoard: async (id: string) => {
      await boards.remove(id);
      columns.invalidate();
      cards.invalidate();
    },

    addColumn: columns.create,
    renameColumn: (id: string, title: string) => columns.update(id, { title }),
    reorderColumn: (id: string, position: number) => columns.update(id, { position }),
    deleteColumn: async (id: string) => {
      await columns.remove(id);
      cards.invalidate();
    },

    addCard: cards.create,
    updateCard: cards.update,
    moveCard: (id: string, columnId: string, position: number) => cards.update(id, { columnId, position }),
    deleteCard: cards.remove,
  };
}
