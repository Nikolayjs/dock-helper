import { Container } from '@mantine/core';
import { IconBook2 } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { KnowledgeGrid } from '../features/knowledgeBase/KnowledgeGrid';
import type { KnowledgeDocument } from '../features/knowledgeBase/types';
import { QUERY_KEY as KNOWLEDGE_KEY, useDocuments } from '../features/knowledgeBase/useDocuments';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

export function GuidelinesPage() {
  const { documents, deleteDocument } = useDocuments('guideline');
  const confirmDelete = useDeleteWithConfirm();
  const navigate = useNavigate();

  const handleDelete = (doc: KnowledgeDocument) =>
    confirmDelete({
      what: 'рекомендацию',
      name: doc.title,
      notice: 'Рекомендация удалена',
      queryKey: KNOWLEDGE_KEY,
      id: doc.id,
      perform: () => deleteDocument(doc.id),
    });

  return (
    <Container size="xl" px={0}>
      <KnowledgeGrid
        documents={documents}
        icon={IconBook2}
        addLabel="Добавить рекомендацию"
        emptyTitle="Пока нет клинических рекомендаций"
        emptyText="Добавьте протокол, чек-лист или конспект рекомендаций с форматированным текстом."
        searchPlaceholder="Поиск по рекомендациям…"
        onAdd={() => navigate('/guidelines/new')}
        onOpen={(doc) => navigate(`/guidelines/${doc.id}`)}
        onEdit={(doc) => navigate(`/guidelines/${doc.id}/edit`)}
        onDelete={handleDelete}
        onTagClick={(tag) => navigate(`/knowledge/tag/${encodeURIComponent(tag)}`)}
      />
    </Container>
  );
}
