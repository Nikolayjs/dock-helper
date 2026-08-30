import type { ReactNode } from 'react';
import { ActionIcon, Badge, Group, Progress, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconChecklist, IconChevronRight, IconEdit, IconNote, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import { useIncrementalList } from '../../lib/useIncrementalList';
import { stripHtml } from './textPreview';
import type { Note } from './types';
import classes from '../drugs/DrugList.module.css';

/**
 * Заметки списком, а не плитками.
 *
 * Плитки оставлены там, где в превью может быть картинка: статья, новость, книга. У заметки превью
 * — это заголовок, несколько строк текста и дата; плитка растягивала три коротких поля на треть
 * ширины экрана, и полсотни заметок приходилось просматривать зигзагом.
 *
 * **Ход чек-листа остаётся виден и в строке.** Полоска выполненного — единственное, ради чего
 * заметку-чек-лист открывают в списке: по ней видно, доделано или нет. Потерять её при переезде на
 * таблицу значило бы обменять вид на смысл.
 */
export type NoteSortKey = 'title' | 'kind' | 'updated';

export const NOTE_SORT_KEYS: readonly NoteSortKey[] = ['title', 'kind', 'updated'];

export function noteSortValue(note: Note, key: NoteSortKey): SortValue {
  switch (key) {
    case 'title':
      return note.title.toLowerCase();
    case 'kind':
      return note.kind;
    case 'updated':
      return note.updatedAt;
  }
}

const preview = (note: Note) =>
  note.kind === 'todo'
    ? note.items.map((item) => item.text).join(' · ') || 'Пустой чек-лист'
    : stripHtml(note.content) || 'Без текста';

function Progression({ note }: { note: Note }) {
  if (note.kind !== 'todo' || note.items.length === 0) return null;
  const done = note.items.filter((item) => item.done).length;
  return (
    <Group gap={8} wrap="nowrap" mt={4}>
      <Progress value={(done / note.items.length) * 100} color={note.color} size={6} radius="xl" w={90} />
      <Text size="xs" c="dimmed">
        {done} из {note.items.length}
      </Text>
    </Group>
  );
}

interface Props {
  notes: Note[];
  sort: SortState<NoteSortKey>;
  onSort: (key: NoteSortKey) => void;
  onOpen: (note: Note) => void;
  onEdit: (note: Note) => void;
  onDelete: (note: Note) => void;
  narrow: boolean;
}

export function NoteTable({ notes, sort, onSort, onOpen, onEdit, onDelete, narrow }: Props) {
  const actions = (note: Note): ReactNode => (
    <Group gap={4} wrap="nowrap">
      <ActionIcon variant="subtle" color="gray" onClick={() => onEdit(note)} aria-label={`Править ${note.title}`}>
        <IconEdit size={16} />
      </ActionIcon>
      <ActionIcon variant="subtle" color="red" onClick={() => onDelete(note)} aria-label={`Удалить ${note.title}`}>
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );

  if (narrow) return <NoteList notes={notes} onOpen={onOpen} actions={actions} />;

  const columns: DataColumn<Note, NoteSortKey>[] = [
    {
      key: 'title',
      header: 'Заметка',
      miw: 380,
      render: (note) => (
        <Group gap={10} wrap="nowrap" align="flex-start">
          <ThemeIcon variant="light" color={note.color} size={30} radius="md" style={{ flexShrink: 0 }}>
            {note.kind === 'todo' ? <IconChecklist size={16} /> : <IconNote size={16} />}
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={600}>
              {note.title}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {preview(note)}
            </Text>
            <Progression note={note} />
          </div>
        </Group>
      ),
    },
    {
      key: 'kind',
      header: 'Вид',
      w: 140,
      render: (note) => (
        <Badge size="sm" variant="light" color={note.color} tt="none">
          {note.kind === 'todo' ? 'Чек-лист' : 'Заметка'}
        </Badge>
      ),
    },
    {
      header: 'Дата',
      w: 150,
      // Закреплённая дата важнее даты правки: заметку прикрепляют к дню приёма, и именно этот день
      // ищут в списке.
      render: (note) =>
        note.pinnedDate ? (
          <Badge size="sm" variant="light" color={note.color} tt="none">
            {dayjs(note.pinnedDate).format('D MMMM')}
          </Badge>
        ) : null,
    },
    {
      key: 'updated',
      header: 'Изменена',
      w: 150,
      render: (note) => (
        <Text size="sm" c="dimmed">
          {dayjs(note.updatedAt).format('DD.MM.YYYY')}
        </Text>
      ),
    },
    { w: 96, stopClick: true, render: actions },
  ];

  return (
    <DataTable
      rows={notes}
      columns={columns}
      rowKey={(note) => note.id}
      sort={sort}
      onSort={onSort}
      onRowClick={onOpen}
      minWidth={900}
    />
  );
}

/** Компактный список на телефоне — стили общие со справочником препаратов. */
function NoteList({
  notes,
  onOpen,
  actions,
}: {
  notes: Note[];
  onOpen: (note: Note) => void;
  actions: (note: Note) => ReactNode;
}) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(notes, 40);

  return (
    <Stack gap={0}>
      {visible.map((note) => (
        <div key={note.id} className={classes.row}>
          <button
            type="button"
            className={classes.main}
            onClick={() => onOpen(note)}
            style={{ background: 'none', border: 0, textAlign: 'left' }}
          >
            <Group gap={8} wrap="nowrap" align="center">
              <ThemeIcon variant="light" color={note.color} size={24} radius="sm" style={{ flexShrink: 0 }}>
                {note.kind === 'todo' ? <IconChecklist size={13} /> : <IconNote size={13} />}
              </ThemeIcon>
              <Text size="sm" fw={600} lineClamp={1}>
                {note.title}
              </Text>
              {note.pinnedDate && (
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                  {dayjs(note.pinnedDate).format('D MMM')}
                </Text>
              )}
            </Group>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {preview(note)}
            </Text>
            <Progression note={note} />
          </button>
          <Group gap={2} wrap="nowrap">
            {actions(note)}
          </Group>
          <IconChevronRight size={16} className={classes.chevron} />
        </div>
      ))}
      {hasMore && (
        <div ref={setSentinel} className={classes.sentinel}>
          <Text size="xs" c="dimmed">
            Загружается ещё… осталось {remaining}
          </Text>
        </div>
      )}
    </Stack>
  );
}
