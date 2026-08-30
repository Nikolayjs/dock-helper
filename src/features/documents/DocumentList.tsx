import { useMemo, useState } from 'react';
import { Box, Button, Group, Menu, Select, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconFileText, IconFileSpreadsheet, IconPlus, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { CatalogPanel } from '../../components/common/CatalogPanel';

import { stripHtml } from '../notes/textPreview';
import { usePatients } from '../patients/usePatients';
import { DOCUMENT_SORT_KEYS, DocumentTable, documentSortValue, type DocumentSortKey } from './DocumentTable';
import { sortRows, useTableSort } from '../../lib/tableSort';
import { KIND_LABEL, type DoctorDocument } from './types';
import { QUERY_KEY, useDoctorDocuments } from './useDoctorDocuments';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';

/** Что показать в карточке под названием, когда краткого описания нет. */
function preview(doc: DoctorDocument): string {
  if (doc.summary.trim()) return doc.summary;
  if (doc.kind === 'sheet') {
    const sheet = doc.sheet;
    if (!sheet || sheet.columns.length === 0) return 'Пустая таблица';
    // Названия столбцов необязательны; когда их нет, о таблице честнее сказать размером.
    const named = sheet.columns.filter((column) => column.trim() !== '');
    if (named.length === 0) return `${sheet.rows.length} строк, ${sheet.columns.length} столбцов`;
    return `${sheet.rows.length} строк · ${named.join(', ')}`;
  }
  return stripHtml(doc.content) || 'Без текста';
}

export function DocumentList({ hint }: { hint?: string }) {
  const navigate = useNavigate();
  const { documents, isLoading, deleteDocument } = useDoctorDocuments();
  // На телефоне таблица из пяти колонок требует бокового смахивания — там компактный список.
  const isNarrow = useMediaQuery('(max-width: 62em)');
  const { sort, toggle } = useTableSort<DocumentSortKey>(
    { key: 'updated', direction: 'desc' },
    { storageKey: 'medassist:sort:documents', keys: DOCUMENT_SORT_KEYS },
  );
  const { patients } = usePatients();
  const confirmDelete = useDeleteWithConfirm();

  const [search, setSearch] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);

  const patientName = useMemo(() => new Map(patients.map((patient) => [patient.id, patient.fullName])), [patients]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (patientId && doc.patientId !== patientId) return false;
      if (!query) return true;
      return (
        doc.title.toLowerCase().includes(query) ||
        doc.summary.toLowerCase().includes(query) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(query))
      );
    });
  }, [documents, patientId, search]);

  const sorted = useMemo(
    () => sortRows(filtered, sort, (doc, key) => documentSortValue(doc, key, patientName)),
    [filtered, sort, patientName],
  );

  /**
   * В выпадающем списке только те пациенты, у кого документы есть.
   *
   * Фильтр, предлагающий всю картотеку, почти всегда выбирает пустоту: документов у врача десятки,
   * а пациентов сотни.
   */
  const patientOptions = useMemo(() => {
    const withDocuments = new Set(documents.map((doc) => doc.patientId).filter(Boolean) as string[]);
    return patients
      .filter((patient) => withDocuments.has(patient.id))
      .map((patient) => ({ value: patient.id, label: patient.fullName }));
  }, [documents, patients]);

  const handleDelete = (doc: DoctorDocument) =>
    confirmDelete({
      what: 'документ',
      name: doc.title,
      notice: 'Документ удалён',
      queryKey: QUERY_KEY,
      id: doc.id,
      perform: () => deleteDocument(doc.id),
    });

  return (
    <CatalogPanel
      header={
      <Stack gap="sm">
        {hint && (
          <Text size="sm" c="dimmed">
            {hint}
          </Text>
        )}
      <Group justify="space-between" wrap="wrap" gap="md">
        <Group gap="sm" wrap="wrap">
          <TextInput
            placeholder="Поиск по документам…"
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            w={260}
          />
          {patientOptions.length > 0 && (
            <Select
              placeholder="Все пациенты"
              data={patientOptions}
              value={patientId}
              onChange={setPatientId}
              searchable
              clearable
              w={220}
            />
          )}
        </Group>

        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Button leftSection={<IconPlus size={18} />}>Создать</Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item leftSection={<IconFileText size={16} />} onClick={() => navigate('/documents/new?kind=text')}>
              Документ Word
              <Text size="xs" c="dimmed">
                Текст с форматированием, скачивается в .docx
              </Text>
            </Menu.Item>
            <Menu.Item leftSection={<IconFileSpreadsheet size={16} />} onClick={() => navigate('/documents/new?kind=sheet')}>
              Таблица Excel
              <Text size="xs" c="dimmed">
                Строки и столбцы, скачивается в .xlsx
              </Text>
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Group>
      </Stack>
      }
    >

      {!isLoading && filtered.length === 0 && (
        <Box p="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconFileText size={24} />
            </ThemeIcon>
            <Text fw={600}>{documents.length === 0 ? 'Пока нет документов' : 'Ничего не найдено'}</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              {documents.length === 0
                ? 'Направление на экспертизу, справка, реестр — всё, что вы пишете сами. Документ можно привязать к пациенту, а можно оставить общим.'
                : 'Попробуйте изменить запрос или снять фильтр по пациенту.'}
            </Text>
          </Stack>
        </Box>
      )}

      {filtered.length > 0 && (
        <DocumentTable
          documents={sorted}
          sort={sort}
          onSort={toggle}
          onOpen={(doc) => navigate(`/documents/${doc.id}`)}
          onEdit={(doc) => navigate(`/documents/${doc.id}/edit`)}
          onDelete={handleDelete}
          patientName={patientName}
          preview={preview}
          kindLabel={KIND_LABEL}
          narrow={isNarrow}
        />
      )}
    </CatalogPanel>
  );
}
