export type NoteKind = 'note' | 'todo';

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface Note {
  id: string;
  kind: NoteKind;
  title: string;
  content: string;
  items: TodoItem[];
  pinnedDate: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export const NOTE_COLORS = ['brand', 'teal', 'orange', 'grape', 'red', 'gray'] as const;
