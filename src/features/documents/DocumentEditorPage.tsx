import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DoctorDocumentForm, type DoctorDocumentFormInput } from './DoctorDocumentForm';
import { KIND_LABEL, type DoctorDocumentKind } from './types';
import { useDoctorDocuments } from './useDoctorDocuments';
import { BackButton } from '../../components/common/BackButton';
import { useFrom } from '../../lib/backTarget';

/** Вид приходит из адреса при создании и из самого документа при правке: сменить его нельзя. */
function kindFromParams(value: string | null): DoctorDocumentKind {
  return value === 'sheet' ? 'sheet' : 'text';
}

export function DocumentEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const from = useFrom();
  const { documents, isLoading, addDocument, updateDocument } = useDoctorDocuments();

  const editing = id ? documents.find((document) => document.id === id) : undefined;

  if (id && !editing) {
    // Пока список не пришёл, «не найден» было бы враньём — и мигало бы на каждом открытии по ссылке.
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

  const kind = editing ? editing.kind : kindFromParams(searchParams.get('kind'));
  const backTo = editing ? `/documents/${editing.id}` : '/documents';

  const handleSubmit = async (input: DoctorDocumentFormInput) => {
    if (editing) {
      await updateDocument(editing.id, { ...input, kind: editing.kind });
      notifications.show({ message: 'Изменения сохранены', color: 'teal' });
      navigate(`/documents/${editing.id}`, { state: from ? { from } : undefined });
    } else {
      const created = await addDocument({ ...input, kind });
      notifications.show({ message: 'Документ создан', color: 'teal' });
      navigate(`/documents/${created.id}`, { state: from ? { from } : undefined });
    }
  };

  const heading = editing
    ? `Редактирование: ${editing.title}`
    : kind === 'sheet'
      ? 'Новая таблица Excel'
      : 'Новый документ Word';

  return (
    <Container size={kind === 'sheet' ? 'xl' : 'md'} px={0}>
      <Stack gap="lg">
        <BackButton fallback={{ to: backTo, label: editing ? 'К документу' : 'К документам' }} />
        <div>
          <Title order={3}>{heading}</Title>
          <Text size="sm" c="dimmed">
            Формат для сохранения и печати — {KIND_LABEL[kind]}
          </Text>
        </div>
        <DoctorDocumentForm
          kind={kind}
          initialDocument={editing}
          initialPatientId={searchParams.get('patient')}
          onSubmit={handleSubmit}
          onCancel={() => navigate(backTo)}
        />
      </Stack>
    </Container>
  );
}
