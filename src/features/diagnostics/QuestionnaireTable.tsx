import { ActionIcon, Group, Text, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import type { Questionnaire } from './types';

/**
 * The diagnostic panels, one row each.
 *
 * A panel is identified by its size as much as by its name — forty diseases against six is the
 * difference between a worked-out differential and a stub — and in a grid of tiles those counts sat
 * in badges that could not be compared across cards. In a column they can be, and sorted by.
 */

export type QuestionnaireSortKey = 'title' | 'diseases' | 'symptoms' | 'updated';

export const QUESTIONNAIRE_SORT_KEYS: readonly QuestionnaireSortKey[] = ['title', 'diseases', 'symptoms', 'updated'];

interface QuestionnaireTableProps {
  questionnaires: Questionnaire[];
  sort: SortState<QuestionnaireSortKey>;
  onSort: (key: QuestionnaireSortKey) => void;
  onOpen: (questionnaire: Questionnaire) => void;
  onEdit: (questionnaire: Questionnaire) => void;
  onDelete: (questionnaire: Questionnaire) => void;
}

export function questionnaireSortValue(questionnaire: Questionnaire, key: QuestionnaireSortKey): SortValue {
  switch (key) {
    case 'title':
      return questionnaire.title;
    case 'diseases':
      return questionnaire.diseases.length;
    case 'symptoms':
      return questionnaire.symptoms.length;
    case 'updated':
      return questionnaire.updatedAt;
  }
}

export function QuestionnaireTable({
  questionnaires,
  sort,
  onSort,
  onOpen,
  onEdit,
  onDelete,
}: QuestionnaireTableProps) {
  const columns: DataColumn<Questionnaire, QuestionnaireSortKey>[] = [
    {
      key: 'title',
      header: 'Название',
      miw: 260,
      // На телефоне остаются название с описанием и кнопки: числа заболеваний и симптомов видно на
      // самой панели, а вчетвером столбцы давали 860 px в экране 390.
      compact: true,
      render: (questionnaire) => (
        <>
          <Text fw={600} size="sm" lineClamp={1}>
            {questionnaire.title}
          </Text>
          {/* Описание — то, чем две панели про одну жалобу отличаются друг от друга, поэтому оно
              остаётся: строкой под названием, а не отдельным столбцом. */}
          <Text size="xs" c="dimmed" lineClamp={1}>
            {questionnaire.description || 'Без описания'}
          </Text>
        </>
      ),
    },
    { key: 'diseases', header: 'Заболеваний', w: 140, render: (q) => q.diseases.length },
    { key: 'symptoms', header: 'Симптомов', w: 130, render: (q) => q.symptoms.length },
    { key: 'updated', header: 'Изменена', w: 140, render: (q) => dayjs(q.updatedAt).format('DD.MM.YYYY') },
    {
      w: 80,
      // Строка сама открывает панель, поэтому кнопки не должны заодно открывать её же.
      stopClick: true,
      compact: true,
      render: (questionnaire) => (
        <Group gap={2} wrap="nowrap" justify="flex-end">
          <Tooltip label="Изменить" withArrow>
            <ActionIcon aria-label="Изменить" variant="subtle" color="gray" size="sm" onClick={() => onEdit(questionnaire)}>
              <IconEdit size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Удалить" withArrow>
            <ActionIcon aria-label="Удалить" variant="subtle" color="red" size="sm" onClick={() => onDelete(questionnaire)}>
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ),
    },
  ];

  return (
    <DataTable
      rows={questionnaires}
      columns={columns}
      rowKey={(questionnaire) => questionnaire.id}
      sort={sort}
      onSort={onSort}
      onRowClick={onOpen}
      minWidth={860}
    />
  );
}
