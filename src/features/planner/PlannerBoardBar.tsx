import { useState } from 'react';
import { ActionIcon, Button, Group, Modal, Stack, Text, Textarea, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react';

import classes from './PlannerBoardBar.module.css';
import type { PlannerBoard } from './types';

/**
 * Полоса глобальных задач над доской.
 *
 * Одна задача — одна доска: колонки и карточки принадлежат ей, и «В работе» на одной задаче ничего
 * не значит для другой. Раньше планер был один на всё сразу, и ремонт кабинета лежал в одной
 * колонке с подготовкой к аттестации.
 *
 * Выбранная задача живёт в адресе, а не в состоянии страницы: ссылка на доску должна открывать ту
 * самую доску — по той же причине, по которой в адресе живёт вкладка раздела «Документы».
 */
interface PlannerBoardBarProps {
  boards: PlannerBoard[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onCreate: (input: { title: string; description: string }) => Promise<void> | void;
  onRename: (id: string, input: { title: string; description: string }) => Promise<void> | void;
  onDelete: (board: PlannerBoard) => void;
}

type Editing = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; board: PlannerBoard };

export function PlannerBoardBar({ boards, activeId, onSelect, onCreate, onRename, onDelete }: PlannerBoardBarProps) {
  const [editing, setEditing] = useState<Editing>({ mode: 'closed' });
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const open = (state: Editing) => {
    setTitle(state.mode === 'edit' ? state.board.title : '');
    setDescription(state.mode === 'edit' ? state.board.description : '');
    setEditing(state);
  };

  const save = async () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (editing.mode === 'edit') await onRename(editing.board.id, { title: trimmed, description: description.trim() });
    else if (editing.mode === 'create') await onCreate({ title: trimmed, description: description.trim() });
    setEditing({ mode: 'closed' });
  };

  const active = boards.find((board) => board.id === activeId) ?? null;

  return (
    <Stack gap={6}>
      <Group gap={8} wrap="nowrap" className={classes.bar}>
        {boards.map((board) => (
          <UnstyledButton
            key={board.id}
            className={classes.tab}
            data-active={board.id === activeId || undefined}
            onClick={() => onSelect(board.id)}
          >
            {board.title}
          </UnstyledButton>
        ))}

        <Button
          size="compact-sm"
          variant="subtle"
          color="gray"
          leftSection={<IconPlus size={14} />}
          onClick={() => open({ mode: 'create' })}
          style={{ flexShrink: 0 }}
        >
          Задача
        </Button>

        {/* Правка и удаление относятся к выбранной задаче и стоят рядом с её вкладкой, а не
            отдельной строкой под ней: иначе непонятно, к чему они, когда описания нет. */}
        {active && (
          <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
            <Tooltip label={`Переименовать: ${active.title}`} withArrow>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                aria-label="Переименовать задачу"
                onClick={() => open({ mode: 'edit', board: active })}
              >
                <IconPencil size={14} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={`Удалить задачу «${active.title}» вместе с её доской`} withArrow>
              <ActionIcon variant="subtle" color="red" size="sm" aria-label="Удалить задачу" onClick={() => onDelete(active)}>
                <IconTrash size={14} />
              </ActionIcon>
            </Tooltip>
          </Group>
        )}
      </Group>

      {active?.description && (
        <Text size="sm" c="dimmed" lineClamp={2}>
          {active.description}
        </Text>
      )}

      <Modal
        opened={editing.mode !== 'closed'}
        onClose={() => setEditing({ mode: 'closed' })}
        title={editing.mode === 'edit' ? 'Задача' : 'Новая задача'}
        radius="lg"
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Название"
            placeholder="Например: Аккредитация"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            data-autofocus
            required
          />
          <Textarea
            label="Описание"
            placeholder="Зачем эта задача и чем она кончится"
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={5}
          />
          {editing.mode === 'create' && (
            <Text size="xs" c="dimmed">
              Доска откроется с колонками «Бэклог», «В работе» и «Готово» — их можно переименовать или удалить.
            </Text>
          )}
          <Group justify="flex-end" gap={8}>
            <Button variant="default" onClick={() => setEditing({ mode: 'closed' })}>
              Отмена
            </Button>
            <Button onClick={save} disabled={!title.trim()}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
