import { useMemo } from 'react';
import { Badge, Button, Container, Group, Stack } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconTag } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { KnowledgeGrid } from '../features/knowledgeBase/KnowledgeGrid';
import type { KnowledgeDocument } from '../features/knowledgeBase/types';
import { useAllDocuments } from '../features/knowledgeBase/useDocuments';

export function KnowledgeTagPage() {
  const { tag: encodedTag } = useParams();
  const tag = decodeURIComponent(encodedTag ?? '');
  const navigate = useNavigate();
  const { documents, deleteDocument } = useAllDocuments();

  const tagged = useMemo(() => documents.filter((doc) => doc.tags.includes(tag)), [documents, tag]);

  const handleOpen = (doc: KnowledgeDocument) => {
    navigate(doc.kind === 'guideline' ? `/guidelines/${doc.id}` : `/articles/${doc.id}`);
  };

  const handleEdit = (doc: KnowledgeDocument) => {
    navigate(doc.kind === 'guideline' ? `/guidelines/${doc.id}/edit` : `/articles/${doc.id}/edit`);
  };

  const handleDelete = (doc: KnowledgeDocument) => {
    deleteDocument(doc.id);
    notifications.show({ message: doc.kind === 'guideline' ? 'Рекомендация удалена' : 'Статья удалена', color: 'gray' });
  };

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Button component={Link} to="/guidelines" variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} pl={8}>
            К базе знаний
          </Button>
          <Badge size="lg" variant="light" color="brand" leftSection={<IconTag size={14} />}>
            {tag}
          </Badge>
        </Group>

        <KnowledgeGrid
          documents={tagged}
          icon={IconTag}
          emptyTitle="Ничего не найдено"
          emptyText={`Нет рекомендаций или статей с тегом «${tag}».`}
          searchPlaceholder="Поиск среди найденного…"
          onOpen={handleOpen}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onTagClick={(nextTag) => navigate(`/knowledge/tag/${encodeURIComponent(nextTag)}`)}
          showGraphLink={false}
        />
      </Stack>
    </Container>
  );
}
