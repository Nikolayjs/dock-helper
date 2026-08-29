import { Button, Center, Container, Loader, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { EDITOR_MIN_HEIGHT } from '../../components/common/editorHeight';
import { useAuth } from '../auth/AuthContext';
import { DocumentForm } from './DocumentForm';
import type { DocumentFormInput } from './DocumentForm';
import type { KnowledgeKind } from './types';
import { useDocuments, useKnowledgeDocument } from './useDocuments';
import { ReadingSheet } from '../../components/common/ReadingSheet';

interface KnowledgeEditorPageProps {
  kind: KnowledgeKind;
  basePath: string;
  notFoundText: string;
  backToListLabel: string;
  newTitle: string;
  editTitle: string;
  savedMessage: string;
  createdMessage: string;
}

export function KnowledgeEditorPage({
  kind,
  basePath,
  notFoundText,
  backToListLabel,
  newTitle,
  editTitle,
  savedMessage,
  createdMessage,
}: KnowledgeEditorPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth();
  const { documents, addDocument, updateDocument } = useDocuments(kind);
  const listedDoc = id ? documents.find((d) => d.id === id) : undefined;
  // Редактору нужен текст, а список его больше не отдаёт: форму показываем только когда документ
  // дочитан целиком, иначе редактор открылся бы пустым и сохранил бы эту пустоту.
  const { document: editingDoc, isLoading: contentLoading } = useKnowledgeDocument(listedDoc?.id);

  if (id && !listedDoc) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>{notFoundText}</Text>
          <Button component={Link} to={basePath} mt="md">
            {backToListLabel}
          </Button>
        </Stack>
      </Container>
    );
  }

  if (id && (contentLoading || !editingDoc)) {
    return (
      <Container size="md" px={0}>
        <Center py={100}>
          <Loader size="sm" />
        </Center>
      </Container>
    );
  }

  const backTo = editingDoc ? `${basePath}/${editingDoc.id}` : basePath;

  const handleSubmit = async (input: DocumentFormInput) => {
    if (editingDoc) {
      await updateDocument(editingDoc.id, { ...input, kind, author: editingDoc.author });
      notifications.show({ message: savedMessage, color: 'teal' });
      navigate(`${basePath}/${editingDoc.id}`);
    } else {
      const created = await addDocument({ ...input, kind, author: user.name });
      notifications.show({ message: createdMessage, color: 'teal' });
      navigate(`${basePath}/${created.id}`);
    }
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Button component={Link} to={backTo} variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8} style={{ alignSelf: 'flex-start' }}>
          Назад
        </Button>
        <Title order={3}>{editingDoc ? editTitle : newTitle}</Title>
        {/* Подложка: без неё подписи полей и текст формы лежат прямо на обоях. */}
        <ReadingSheet>
          <DocumentForm initialDocument={editingDoc ?? undefined} onSubmit={handleSubmit} onCancel={() => navigate(backTo)} contentMinHeight={EDITOR_MIN_HEIGHT} />
        </ReadingSheet>
      </Stack>
    </Container>
  );
}
