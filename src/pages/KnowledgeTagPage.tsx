import { useMemo } from 'react';
import { Badge, Container, Group, Stack } from '@mantine/core';
import { IconTag } from '@tabler/icons-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { BackButton } from '../components/common/BackButton';
import { hasTag } from '../features/knowledgeBase/tags';

import { KnowledgeGrid } from '../features/knowledgeBase/KnowledgeGrid';
import type { KnowledgeDocumentSummary } from '../features/knowledgeBase/types';
import { QUERY_KEY as KNOWLEDGE_KEY, useAllDocuments } from '../features/knowledgeBase/useDocuments';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

export function KnowledgeTagPage() {
  const { tag: encodedTag } = useParams();
  const tag = decodeURIComponent(encodedTag ?? '');
  const navigate = useNavigate();
  const location = useLocation();
  const { documents, deleteDocument } = useAllDocuments();
  const confirmDelete = useDeleteWithConfirm();

  // Регистр тега значения не имеет: «ЛОР» и «лор» — один и тот же тег, см. `tags.ts`.
  const tagged = useMemo(() => documents.filter((doc) => hasTag(doc.tags, tag)), [documents, tag]);

  const handleOpen = (doc: KnowledgeDocumentSummary) => {
    navigate(doc.kind === 'guideline' ? `/guidelines/${doc.id}` : `/articles/${doc.id}`);
  };

  const handleEdit = (doc: KnowledgeDocumentSummary) => {
    navigate(doc.kind === 'guideline' ? `/guidelines/${doc.id}/edit` : `/articles/${doc.id}/edit`);
  };

  const handleDelete = (doc: KnowledgeDocumentSummary) =>
    confirmDelete({
      what: doc.kind === 'guideline' ? 'рекомендацию' : 'статью',
      name: doc.title,
      notice: doc.kind === 'guideline' ? 'Рекомендация удалена' : 'Статья удалена',
      queryKey: KNOWLEDGE_KEY,
      id: doc.id,
      perform: () => deleteDocument(doc.id),
    });

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          {/*
            Возврат туда, откуда пришли, а не в раздел рекомендаций.
        
            Кнопка вела на `/guidelines` жёстко, и врач, нажавший тег в статье, оказывался в
            клинических рекомендациях — то самое враньё, ради которого в приложении заведён
            `BackButton`: ссылка сообщает происхождение, страница его читает.
          */}
          <BackButton fallback={{ to: '/articles', label: 'К статьям' }} />
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
          onTagClick={(nextTag) =>
            navigate(`/knowledge/tag/${encodeURIComponent(nextTag)}`, { state: { from: location.pathname } })
          }
        />
      </Stack>
    </Container>
  );
}
