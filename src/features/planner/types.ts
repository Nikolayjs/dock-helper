/**
 * Глобальная задача: одна доска со своими колонками и карточками.
 *
 * До этого планер был один, и работа над разными делами лежала вперемешку — «В работе» означало
 * сразу и ремонт кабинета, и подготовку к аттестации.
 */
export interface PlannerBoard {
  id: string;
  title: string;
  description: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlannerColumn {
  id: string;
  boardId: string | null;
  title: string;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export type PlannerCardColor = 'gray' | 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'violet' | 'pink';

export const CARD_COLORS: PlannerCardColor[] = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'pink'];

export interface PlannerCard {
  id: string;
  columnId: string;
  /** Кто завёл карточку — ставит сервер; кто взялся за работу — выбирают руками. */
  authorId: string | null;
  assigneeId: string | null;
  title: string;
  description: string;
  color: PlannerCardColor | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}
