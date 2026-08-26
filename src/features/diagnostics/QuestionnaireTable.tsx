import { ActionIcon, Group, Table, Text, Tooltip } from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { SortableTh } from '../../components/common/SortableTh';
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
  return (
    <Table.ScrollContainer minWidth={860}>
      <Table highlightOnHover verticalSpacing="sm" fz="sm">
        <Table.Thead>
          <Table.Tr>
            <SortableTh column="title" sort={sort} onSort={onSort} miw={260}>
              Название
            </SortableTh>
            <SortableTh column="diseases" sort={sort} onSort={onSort} w={140}>
              Заболеваний
            </SortableTh>
            <SortableTh column="symptoms" sort={sort} onSort={onSort} w={130}>
              Симптомов
            </SortableTh>
            <SortableTh column="updated" sort={sort} onSort={onSort} w={140}>
              Изменена
            </SortableTh>
            <Table.Th w={80} />
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {questionnaires.map((questionnaire) => (
            <Table.Tr
              key={questionnaire.id}
              style={{ cursor: 'pointer' }}
              onClick={() => onOpen(questionnaire)}
            >
              <Table.Td>
                <Text fw={600} size="sm" lineClamp={1}>
                  {questionnaire.title}
                </Text>
                {/* The description is what tells two panels for the same complaint apart, so it
                    stays — one line under the name rather than a paragraph of its own column. */}
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {questionnaire.description || 'Без описания'}
                </Text>
              </Table.Td>
              <Table.Td>{questionnaire.diseases.length}</Table.Td>
              <Table.Td>{questionnaire.symptoms.length}</Table.Td>
              <Table.Td>{dayjs(questionnaire.updatedAt).format('DD.MM.YYYY')}</Table.Td>
              {/* The row itself opens the panel, so the buttons must not also trigger it. */}
              <Table.Td onClick={(e) => e.stopPropagation()}>
                <Group gap={2} wrap="nowrap" justify="flex-end">
                  <Tooltip label="Изменить" withArrow>
                    <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => onEdit(questionnaire)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Удалить" withArrow>
                    <ActionIcon variant="subtle" color="red" size="sm" onClick={() => onDelete(questionnaire)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
