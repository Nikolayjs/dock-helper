export interface PlannerColumn {
  id: string;
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
  title: string;
  description: string;
  color: PlannerCardColor | null;
  dueDate: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}
