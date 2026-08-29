import { Badge, Button, Container, Group, Stack, Text, Title, Typography } from '@mantine/core';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconEdit, IconPrinter, IconTrash, IconUser } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';

import '../knowledgeBase/editorContent.css';
import { downloadDocx } from '../../lib/docx/downloadDocx';
import { downloadXlsx } from '../../lib/xlsx/downloadXlsx';
import { usePatients } from '../patients/usePatients';
import { SheetTable } from './SheetTable';
import { KIND_LABEL } from './types';
import { QUERY_KEY, useDoctorDocuments } from './useDoctorDocuments';
import { BackButton } from '../../components/common/BackButton';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { SafeHtml } from '../../components/common/SafeHtml';

export function DocumentViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { documents, isLoading, deleteDocument } = useDoctorDocuments();
  const { patients } = usePatients();
  const confirmDelete = useDeleteWithConfirm();

  const doc = documents.find((candidate) => candidate.id === id);

  if (!doc) {
    if (isLoading) return null;
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Документ не найден</Text>
          <Button component={Link} to="/documents" mt="md">
            К документам
          </Button>
        </Stack>
      </Container>
    );
  }

  const patient = doc.patientId ? patients.find((candidate) => candidate.id === doc.patientId) : null;

  const handleDownload = async () => {
    try {
      if (doc.kind === 'sheet') {
        await downloadXlsx({
          sheetName: doc.title,
          columns: doc.sheet?.columns ?? [],
          rows: doc.sheet?.rows ?? [],
          totals: doc.sheet?.totals,
          formats: doc.sheet?.formats,
          widths: doc.sheet?.widths,
        });
      } else {
        await downloadDocx({ title: doc.title, html: doc.content });
      }
    } catch {
      notifications.show({ message: 'Не удалось собрать файл', color: 'red' });
    }
  };

  const handleDelete = () =>
    confirmDelete({
      what: 'документ',
      name: doc.title,
      notice: 'Документ удалён',
      queryKey: QUERY_KEY,
      id: doc.id,
      perform: () => deleteDocument(doc.id),
      onConfirmed: () => navigate('/documents'),
    });

  return (
    <Container size={doc.kind === 'sheet' ? 'xl' : 'md'} px={0}>
      <Stack gap="lg">
        <Group className="no-print" justify="space-between" wrap="wrap">
          <BackButton fallback={{ to: '/documents', label: 'К документам' }} />
          <Group gap="xs">
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
              Удалить
            </Button>
            <Button variant="subtle" leftSection={<IconDownload size={16} />} onClick={() => void handleDownload()}>
              Скачать .{doc.kind === 'sheet' ? 'xlsx' : 'docx'}
            </Button>
            <Button variant="subtle" leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
              Печать
            </Button>
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/documents/${doc.id}/edit`)}>
              Редактировать
            </Button>
          </Group>
        </Group>

        {/* Название, теги и дата — часть документа, поэтому лежат на той же подложке, что и текст:
            иначе заголовок оставался бы на обоях, то есть ровно там, где его хуже всего видно.
            Снаружи остаются только действия над документом — они относятся к странице, не к тексту. */}
        <ReadingSheet className="printable-report">
          <Group gap="xs" mb={6}>
            <Badge variant="light" color={doc.kind === 'sheet' ? 'teal' : 'brand'} size="sm">
              {KIND_LABEL[doc.kind]}
            </Badge>
            {patient && (
              <Badge
                variant="light"
                color="gray"
                size="sm"
                leftSection={<IconUser size={11} />}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/patients/${patient.id}`, { state: { from: `/documents/${doc.id}` } })}
              >
                {patient.fullName}
              </Badge>
            )}
            {/* Ссылка на пациента может повиснуть: пациента удаляют, документ остаётся. Молча
                прятать привязку нельзя — на бумаге чьё-то имя всё ещё стоит. */}
            {doc.patientId && !patient && (
              <Badge variant="light" color="orange" size="sm">
                Пациент удалён
              </Badge>
            )}
          </Group>

          <Title order={2}>{doc.title}</Title>
          {doc.summary && (
            <Text size="sm" c="dimmed" mt={6}>
              {doc.summary}
            </Text>
          )}
          {doc.tags.length > 0 && (
            <Group gap={6} mt={10}>
              {doc.tags.map((tag) => (
                <Badge key={tag} size="sm" variant="light" color="gray">
                  {tag}
                </Badge>
              ))}
            </Group>
          )}
          <Text size="xs" c="dimmed" mt={8} mb="lg">
            Изменён {dayjs(doc.updatedAt).format('D MMMM YYYY')}
          </Text>

          {doc.kind === 'sheet' ? (
            <SheetTable sheet={doc.sheet} />
          ) : (
            <Typography>
              <SafeHtml html={doc.content} />
            </Typography>
          )}
        </ReadingSheet>
      </Stack>
    </Container>
  );
}
