import { useMemo, useState } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Menu, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconEdit, IconFileText, IconFileSpreadsheet, IconPlus, IconSearch, IconTrash, IconUser } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { CatalogToolbar } from '../../components/common/CatalogPanel';

import { stripHtml } from '../notes/textPreview';
import { usePatients } from '../patients/usePatients';
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
    <Stack gap="lg">
      <CatalogToolbar>
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
      </CatalogToolbar>

      {!isLoading && filtered.length === 0 && (
        <Card withBorder padding="xl">
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
        </Card>
      )}

      {filtered.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {filtered.map((doc) => (
            <Card
              key={doc.id}
              withBorder
              padding="md"
              h="100%"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/documents/${doc.id}`)}
            >
              <Group justify="space-between" align="flex-start" mb="xs" wrap="nowrap">
                <Group gap={8} wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" color={doc.kind === 'sheet' ? 'teal' : 'brand'} size={32} radius="md">
                    {doc.kind === 'sheet' ? <IconFileSpreadsheet size={17} /> : <IconFileText size={17} />}
                  </ThemeIcon>
                  <Text fw={600} size="sm" truncate>
                    {doc.title}
                  </Text>
                </Group>
                <Group gap={2} wrap="nowrap" onClick={(event) => event.stopPropagation()}>
                  <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => navigate(`/documents/${doc.id}/edit`)}>
                    <IconEdit size={14} />
                  </ActionIcon>
                  <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDelete(doc)}>
                    <IconTrash size={14} />
                  </ActionIcon>
                </Group>
              </Group>

              <Text size="sm" c="dimmed" lineClamp={3} mb="sm">
                {preview(doc)}
              </Text>

              <Group gap={6} mb="sm">
                <Badge size="xs" variant="light" color={doc.kind === 'sheet' ? 'teal' : 'brand'}>
                  {KIND_LABEL[doc.kind]}
                </Badge>
                {doc.patientId && (
                  <Badge size="xs" variant="light" color={patientName.has(doc.patientId) ? 'gray' : 'orange'} leftSection={<IconUser size={10} />}>
                    {patientName.get(doc.patientId) ?? 'Пациент удалён'}
                  </Badge>
                )}
                {doc.tags.map((tag) => (
                  <Badge key={tag} size="xs" variant="light" color="gray">
                    {tag}
                  </Badge>
                ))}
              </Group>

              <Text size="xs" c="dimmed" mt="auto">
                {dayjs(doc.updatedAt).format('D MMMM YYYY')}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
