import type { ReactNode } from 'react';
import { ActionIcon, Badge, Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconChevronRight, IconEdit, IconFileSpreadsheet, IconFileText, IconTrash, IconUser } from '@tabler/icons-react';
import dayjs from 'dayjs';

import { DataTable } from '../../components/common/DataTable';
import type { DataColumn } from '../../components/common/DataTable';
import type { SortState, SortValue } from '../../lib/tableSort';
import { useIncrementalList } from '../../lib/useIncrementalList';
import type { DoctorDocument } from './types';
import classes from '../drugs/DrugList.module.css';

/**
 * Документы врача списком, а не плитками.
 *
 * Плитки оставлены там, где в превью может быть картинка: статья, новость, книга. Документ врача —
 * это направление, справка или реестр: заголовок, вид, пациент и дата. Четыре коротких поля в
 * плитке на треть экрана читались зигзагом, а в колонках сравниваются сверху вниз — что и делают с
 * реестром, когда ищут нужную бумагу.
 */
export type DocumentSortKey = 'title' | 'kind' | 'patient' | 'updated';

export const DOCUMENT_SORT_KEYS: readonly DocumentSortKey[] = ['title', 'kind', 'patient', 'updated'];

interface Props {
  documents: DoctorDocument[];
  sort: SortState<DocumentSortKey>;
  onSort: (key: DocumentSortKey) => void;
  onOpen: (doc: DoctorDocument) => void;
  onEdit: (doc: DoctorDocument) => void;
  onDelete: (doc: DoctorDocument) => void;
  /** Имя пациента по `id`; отсутствие означает, что пациента удалили. */
  patientName: Map<string, string>;
  preview: (doc: DoctorDocument) => string;
  kindLabel: Record<string, string>;
  narrow: boolean;
}

export function documentSortValue(
  doc: DoctorDocument,
  key: DocumentSortKey,
  patientName: Map<string, string>,
): SortValue {
  switch (key) {
    case 'title':
      return doc.title.toLowerCase();
    case 'kind':
      return doc.kind;
    case 'patient':
      // Документы без пациента — в конце: пустота это не «имя, начинающееся с пробела».
      return doc.patientId ? (patientName.get(doc.patientId) ?? 'яя').toLowerCase() : null;
    case 'updated':
      return doc.updatedAt;
  }
}

export function DocumentTable({
  documents,
  sort,
  onSort,
  onOpen,
  onEdit,
  onDelete,
  patientName,
  preview,
  kindLabel,
  narrow,
}: Props) {
  const kindColor = (doc: DoctorDocument) => (doc.kind === 'sheet' ? 'teal' : 'brand');

  const patient = (doc: DoctorDocument): ReactNode => {
    if (!doc.patientId) return null;
    const known = patientName.has(doc.patientId);
    // «Пациент удалён» показывается, а не прячется: на бумаге чьё-то имя всё ещё стоит.
    return (
      <Badge size="sm" variant="light" color={known ? 'gray' : 'orange'} tt="none" leftSection={<IconUser size={10} />}>
        {patientName.get(doc.patientId) ?? 'Пациент удалён'}
      </Badge>
    );
  };

  const actions = (doc: DoctorDocument): ReactNode => (
    <Group gap={4} wrap="nowrap">
      <ActionIcon variant="subtle" color="gray" onClick={() => onEdit(doc)} aria-label={`Править ${doc.title}`}>
        <IconEdit size={16} />
      </ActionIcon>
      <ActionIcon variant="subtle" color="red" onClick={() => onDelete(doc)} aria-label={`Удалить ${doc.title}`}>
        <IconTrash size={16} />
      </ActionIcon>
    </Group>
  );

  if (narrow) {
    return <DocumentList documents={documents} onOpen={onOpen} actions={actions} patient={patient} preview={preview} />;
  }

  const columns: DataColumn<DoctorDocument, DocumentSortKey>[] = [
    {
      key: 'title',
      header: 'Документ',
      miw: 360,
      render: (doc) => (
        <Group gap={10} wrap="nowrap" align="flex-start">
          <ThemeIcon variant="light" color={kindColor(doc)} size={30} radius="md" style={{ flexShrink: 0 }}>
            {doc.kind === 'sheet' ? <IconFileSpreadsheet size={16} /> : <IconFileText size={16} />}
          </ThemeIcon>
          <div style={{ minWidth: 0 }}>
            <Text size="sm" fw={600}>
              {doc.title}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {preview(doc)}
            </Text>
            {doc.tags.length > 0 && (
              <Text size="xs" c="dimmed">
                {doc.tags.join(' · ')}
              </Text>
            )}
          </div>
        </Group>
      ),
    },
    {
      key: 'kind',
      header: 'Вид',
      w: 130,
      render: (doc) => (
        <Badge size="sm" variant="light" color={kindColor(doc)} tt="none">
          {kindLabel[doc.kind]}
        </Badge>
      ),
    },
    { key: 'patient', header: 'Пациент', w: 220, render: patient },
    {
      key: 'updated',
      header: 'Изменён',
      w: 150,
      render: (doc) => (
        <Text size="sm" c="dimmed">
          {dayjs(doc.updatedAt).format('DD.MM.YYYY')}
        </Text>
      ),
    },
    { w: 96, stopClick: true, render: actions },
  ];

  return (
    <DataTable
      rows={documents}
      columns={columns}
      rowKey={(doc) => doc.id}
      sort={sort}
      onSort={onSort}
      onRowClick={onOpen}
      minWidth={960}
    />
  );
}

/** Компактный список на телефоне — стили общие со справочником препаратов. */
function DocumentList({
  documents,
  onOpen,
  actions,
  patient,
  preview,
}: {
  documents: DoctorDocument[];
  onOpen: (doc: DoctorDocument) => void;
  actions: (doc: DoctorDocument) => ReactNode;
  patient: (doc: DoctorDocument) => ReactNode;
  preview: (doc: DoctorDocument) => string;
}) {
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(documents, 40);

  return (
    <Stack gap={0}>
      {visible.map((doc) => (
        <div key={doc.id} className={classes.row}>
          <button
            type="button"
            className={classes.main}
            onClick={() => onOpen(doc)}
            style={{ background: 'none', border: 0, textAlign: 'left' }}
          >
            <Group gap={8} wrap="nowrap" align="center">
              <ThemeIcon
                variant="light"
                color={doc.kind === 'sheet' ? 'teal' : 'brand'}
                size={24}
                radius="sm"
                style={{ flexShrink: 0 }}
              >
                {doc.kind === 'sheet' ? <IconFileSpreadsheet size={13} /> : <IconFileText size={13} />}
              </ThemeIcon>
              <Text size="sm" fw={600} lineClamp={1}>
                {doc.title}
              </Text>
            </Group>
            <Text size="xs" c="dimmed" lineClamp={2}>
              {preview(doc)}
            </Text>
            <Group gap={6} wrap="wrap" mt={2}>
              {patient(doc)}
              <Text size="xs" c="dimmed">
                {dayjs(doc.updatedAt).format('DD.MM.YYYY')}
              </Text>
            </Group>
          </button>
          <Group gap={2} wrap="nowrap">
            {actions(doc)}
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
