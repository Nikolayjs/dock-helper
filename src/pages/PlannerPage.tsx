import { useEffect, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Box, Button, Container, Group, Paper, Skeleton, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';

import { PageToolbar } from '../components/common/PageToolbar';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';

import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { PlannerBoardBar } from '../features/planner/PlannerBoardBar';
import { PlannerCardItem } from '../features/planner/PlannerCardItem';
import { PlannerCardModal } from '../features/planner/PlannerCardModal';
import { PlannerColumnCard } from '../features/planner/PlannerColumnCard';
import { positionBetween } from '../features/planner/position';
import type { PlannerBoard as GlobalTask, PlannerCard, PlannerCardColor, PlannerColumn } from '../features/planner/types';
import { usePlanner } from '../features/planner/usePlanner';
import { useScreenFitHeight } from '../components/common/useScreenFitHeight';

type ModalState = { mode: 'closed' } | { mode: 'edit'; card: PlannerCard } | { mode: 'create'; columnId: string };

interface Board {
  columns: PlannerColumn[];
  cardsByColumn: Record<string, PlannerCard[]>;
}

function buildBoard(columns: PlannerColumn[], cards: PlannerCard[]): Board {
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);
  const cardsByColumn: Record<string, PlannerCard[]> = {};
  for (const column of sortedColumns) cardsByColumn[column.id] = [];
  for (const card of cards) {
    (cardsByColumn[card.columnId] ??= []).push(card);
  }
  for (const id of Object.keys(cardsByColumn)) cardsByColumn[id].sort((a, b) => a.position - b.position);
  return { columns: sortedColumns, cardsByColumn };
}

export function PlannerPage() {
  const {
    boards,
    columns,
    cards,
    isLoading,
    addBoard,
    renameBoard,
    deleteBoard,
    addColumn,
    renameColumn,
    reorderColumn,
    deleteColumn,
    addCard,
    updateCard,
    moveCard,
    deleteCard,
  } = usePlanner();
  const confirmDelete = useDeleteWithConfirm();

  /**
   * Выбранная задача живёт в адресе, а не в состоянии страницы.
   *
   * Ссылка на доску должна открывать ту самую доску — по той же причине, по которой в адресе живёт
   * вкладка раздела «Документы». Пока адрес молчит или называет доску, которой больше нет, открыта
   * первая: пустой планер при непустом списке задач был бы враньём.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedBoardId = searchParams.get('board');
  const activeBoard = boards.find((item) => item.id === requestedBoardId) ?? boards[0] ?? null;

  const selectBoard = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('board', id);
    setSearchParams(next, { replace: true });
  };

  const [board, setBoard] = useState<Board>({ columns: [], cardsByColumn: {} });
  const isDraggingRef = useRef(false);

  /*
   * Доска занимает экран до низа окна и прокручивается внутри себя — вбок по колонкам, вниз по
   * карточкам внутри колонки.
   *
   * Иначе колонки во всю высоту утаскивают за собой страницу, а горизонтальная полоса прокрутки
   * оказывается под нижней колонкой, то есть за экраном: врач, читающий начало доски, о колонках
   * справа не узнаёт вовсе. Та же ловушка, из-за которой рабочее место таблицы меряет свою высоту.
   */
  const boardRef = useRef<HTMLDivElement>(null);
  // `ready` обязателен: пока едут доски, страница показывает скелетоны и доски не рисует вовсе, а о
  // появлении узла ссылка не сообщает — эффект с неизменными зависимостями второй раз не запустится
  // и высота осталась бы `null` (замер: доска 1551 px при окне 900).
  const boardHeight = useScreenFitHeight(boardRef, { gap: 16, min: 320, ready: !isLoading });

  useEffect(() => {
    if (isDraggingRef.current) return;
    // На доске только её колонки. Карточка принадлежит колонке, поэтому отбирать их отдельно не
    // нужно: чужие просто не найдут, куда лечь.
    setBoard(buildBoard(columns.filter((column) => column.boardId === activeBoard?.id), cards));
  }, [columns, cards, activeBoard?.id]);

  const [activeCard, setActiveCard] = useState<PlannerCard | null>(null);
  const [modal, setModal] = useState<ModalState>({ mode: 'closed' });
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnTitle, setNewColumnTitle] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumnIdForCard = (cardId: string, b: Board): string | undefined =>
    Object.keys(b.cardsByColumn).find((colId) => b.cardsByColumn[colId].some((c) => c.id === cardId));

  const handleDragStart = (event: DragStartEvent) => {
    isDraggingRef.current = true;
    if (event.active.data.current?.type !== 'card') return;
    const colId = findColumnIdForCard(String(event.active.id), board);
    const card = colId ? board.cardsByColumn[colId].find((c) => c.id === event.active.id) : undefined;
    setActiveCard(card ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over || active.data.current?.type !== 'card') return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const overData = over.data.current as { type?: string; columnId?: string } | undefined;
    const targetColumnId = overData?.columnId;
    if (!targetColumnId) return;

    setBoard((prev) => {
      const sourceColumnId = findColumnIdForCard(activeId, prev);
      if (!sourceColumnId || sourceColumnId === targetColumnId) return prev;

      const sourceItems = [...prev.cardsByColumn[sourceColumnId]];
      const activeIndex = sourceItems.findIndex((c) => c.id === activeId);
      if (activeIndex === -1) return prev;
      const [moved] = sourceItems.splice(activeIndex, 1);

      const destItems = [...(prev.cardsByColumn[targetColumnId] ?? [])];
      const overIndex = overData?.type === 'card' ? destItems.findIndex((c) => c.id === overId) : -1;
      const insertAt = overIndex === -1 ? destItems.length : overIndex;
      destItems.splice(insertAt, 0, { ...moved, columnId: targetColumnId });

      return { ...prev, cardsByColumn: { ...prev.cardsByColumn, [sourceColumnId]: sourceItems, [targetColumnId]: destItems } };
    });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    isDraggingRef.current = false;
    const { active, over } = event;
    const type = active.data.current?.type;

    if (type === 'column') {
      if (!over || active.id === over.id) return;
      const oldIndex = board.columns.findIndex((c) => c.id === active.id);
      const newIndex = board.columns.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      const reordered = arrayMove(board.columns, oldIndex, newIndex);
      setBoard((prev) => ({ ...prev, columns: reordered }));
      const finalIndex = reordered.findIndex((c) => c.id === active.id);
      const position = positionBetween(reordered[finalIndex - 1]?.position, reordered[finalIndex + 1]?.position);
      try {
        await reorderColumn(String(active.id), position);
      } catch {
        notifications.show({ message: 'Не удалось сохранить порядок колонок', color: 'red' });
      }
      return;
    }

    setActiveCard(null);
    if (type !== 'card' || !over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    const overData = over.data.current as { type?: string; columnId?: string } | undefined;
    const targetColumnId = findColumnIdForCard(activeId, board) ?? overData?.columnId;
    if (!targetColumnId) return;

    const items = board.cardsByColumn[targetColumnId] ?? [];
    const activeIndex = items.findIndex((c) => c.id === activeId);
    if (activeIndex === -1) return;
    let overIndex = items.findIndex((c) => c.id === overId);
    if (overIndex === -1) overIndex = items.length - 1;

    const reordered = arrayMove(items, activeIndex, overIndex);
    setBoard((prev) => ({ ...prev, cardsByColumn: { ...prev.cardsByColumn, [targetColumnId]: reordered } }));

    const finalIndex = reordered.findIndex((c) => c.id === activeId);
    const position = positionBetween(reordered[finalIndex - 1]?.position, reordered[finalIndex + 1]?.position);
    try {
      await moveCard(activeId, targetColumnId, position);
    } catch {
      notifications.show({ message: 'Не удалось сохранить перемещение карточки', color: 'red' });
    }
  };

  const handleAddColumn = async () => {
    const title = newColumnTitle.trim();
    if (!title) {
      setAddingColumn(false);
      return;
    }
    const lastPosition = board.columns.at(-1)?.position;
    if (!activeBoard) return;
    try {
      await addColumn({ boardId: activeBoard.id, title, position: positionBetween(lastPosition, undefined) });
      setNewColumnTitle('');
      setAddingColumn(false);
    } catch {
      notifications.show({ message: 'Не удалось создать колонку', color: 'red' });
    }
  };

  const handleDeleteColumn = async (column: PlannerColumn) => {
    try {
      await deleteColumn(column.id);
    } catch {
      notifications.show({ message: 'Не удалось удалить колонку', color: 'red' });
    }
  };

  const handleSaveCard = async (input: {
    title: string;
    description: string;
    color: PlannerCardColor | null;
    dueDate: string | null;
    assigneeId: string | null;
  }) => {
    try {
      if (modal.mode === 'edit') {
        await updateCard(modal.card.id, input);
      } else if (modal.mode === 'create') {
        const lastPosition = board.cardsByColumn[modal.columnId]?.at(-1)?.position;
        await addCard({ ...input, columnId: modal.columnId, position: positionBetween(lastPosition, undefined) });
      }
      setModal({ mode: 'closed' });
    } catch {
      notifications.show({ message: 'Не удалось сохранить карточку', color: 'red' });
    }
  };

  const handleDeleteCard = async (id: string) => {
    try {
      await deleteCard(id);
      setModal({ mode: 'closed' });
    } catch {
      notifications.show({ message: 'Не удалось удалить карточку', color: 'red' });
    }
  };

  const handleDeleteBoard = (task: GlobalTask) => {
    confirmDelete({
      what: 'задачу',
      name: task.title,
      notice: 'Задача удалена',
      queryKey: ['planner-boards'],
      id: task.id,
      perform: () => deleteBoard(task.id),
      // Уходит вся доска целиком, а не только строка в полосе задач.
      alsoRemoves: 'Вместе с ней удалятся её колонки и карточки',
    });
  };

  if (isLoading) {
    return (
      <Container size="xl" px={0}>
        <Group align="flex-start" gap="md">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={300} w={280} radius="lg" />
          ))}
        </Group>
      </Container>
    );
  }

  /* Полоса задач — на поверхности, как верхушка любого раздела: см. `PageToolbar`. */
  const boardBar = (
    <PageToolbar>
    <PlannerBoardBar
      boards={boards}
      activeId={activeBoard?.id ?? null}
      onSelect={selectBoard}
      onCreate={async (input) => {
        try {
          const created = await addBoard({ ...input, position: positionBetween(boards.at(-1)?.position, undefined) });
          selectBoard(created.id);
        } catch {
          notifications.show({ message: 'Не удалось создать задачу', color: 'red' });
        }
      }}
      onRename={async (id, input) => {
        try {
          await renameBoard(id, input);
        } catch {
          notifications.show({ message: 'Не удалось сохранить задачу', color: 'red' });
        }
      }}
      onDelete={handleDeleteBoard}
    />
    </PageToolbar>
  );

  if (!activeBoard) {
    return (
      <Container size="xl" px={0} style={{ maxWidth: 'none' }}>
        <Stack gap="lg">
          {boardBar}
          <Paper withBorder radius="lg" p="xl">
            <Stack align="center" gap={6}>
              <Text fw={600}>Пока ни одной задачи</Text>
              <Text size="sm" c="dimmed" ta="center">
                Задача — это доска: колонки и карточки принадлежат ей одной. Ремонт кабинета и подготовка к аттестации не
                мешают друг другу, потому что живут на разных досках.
              </Text>
            </Stack>
          </Paper>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="xl" px={0} style={{ maxWidth: 'none' }}>
      <Box mb="md">{boardBar}</Box>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Пустая обёртка не украшение: высоту хук считает от места **родителя** в документе, а
            родителем без неё оказался бы `Container` страницы — то есть доска считала бы своим и
            место под полосой задач над ней (замер: низ доски 972 при окне 900). */}
        <div>
        <Box ref={boardRef} style={{ overflowX: 'auto', paddingBottom: 8, height: boardHeight ?? undefined }}>
          {/*
            Колонки растягиваются на всю высоту доски (`align="stretch"`), а не облегают свои
            карточки: цель перетаскивания — весь столбец, а не полоса высотой в две карточки.
          */}
          <Group align="stretch" gap="md" wrap="nowrap" style={{ height: '100%', minHeight: 320 }}>
            <SortableContext items={board.columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
              {board.columns.map((column) => (
                <PlannerColumnCard
                  key={column.id}
                  column={column}
                  cards={board.cardsByColumn[column.id] ?? []}
                  onRename={(title) => renameColumn(column.id, title)}
                  onDelete={() => handleDeleteColumn(column)}
                  onAddCard={() => setModal({ mode: 'create', columnId: column.id })}
                  onOpenCard={(card) => setModal({ mode: 'edit', card })}
                />
              ))}
            </SortableContext>

            {/* Заготовка новой колонки ростом со своё содержимое: тянуть её на всю высоту незачем —
                карточек в ней нет и не будет, пока колонку не создали. */}
            <Paper style={{ width: 280, flexShrink: 0, alignSelf: 'flex-start' }} withBorder radius="lg" p="sm">
              {addingColumn ? (
                <Stack gap={8}>
                  <TextInput
                    placeholder="Название колонки"
                    value={newColumnTitle}
                    onChange={(e) => {
                      const value = e.currentTarget.value;
                      setNewColumnTitle(value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleAddColumn();
                      if (e.key === 'Escape') {
                        setAddingColumn(false);
                        setNewColumnTitle('');
                      }
                    }}
                    data-autofocus
                    autoFocus
                  />
                  <Group gap={8}>
                    <Button size="xs" onClick={handleAddColumn}>
                      Добавить
                    </Button>
                    <Button
                      size="xs"
                      variant="subtle"
                      color="gray"
                      onClick={() => {
                        setAddingColumn(false);
                        setNewColumnTitle('');
                      }}
                    >
                      Отмена
                    </Button>
                  </Group>
                </Stack>
              ) : (
                <UnstyledButton
                  onClick={() => setAddingColumn(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', color: 'var(--mantine-color-dimmed)' }}
                >
                  <IconPlus size={16} />
                  <Text size="sm">Добавить колонку</Text>
                </UnstyledButton>
              )}
            </Paper>
          </Group>
        </Box>
        </div>

        <DragOverlay>{activeCard ? <PlannerCardItem card={activeCard} onOpen={() => {}} /> : null}</DragOverlay>
      </DndContext>

      <PlannerCardModal
        opened={modal.mode !== 'closed'}
        card={modal.mode === 'edit' ? modal.card : null}
        onClose={() => setModal({ mode: 'closed' })}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
      />
    </Container>
  );
}
