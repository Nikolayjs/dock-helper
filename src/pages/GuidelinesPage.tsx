import { Container } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconBook2 } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { KnowledgeGrid } from '../features/knowledgeBase/KnowledgeGrid';
import type { KnowledgeDocument } from '../features/knowledgeBase/types';
import { useDocuments } from '../features/knowledgeBase/useDocuments';

export function GuidelinesPage() {
  const { documents, deleteDocument } = useDocuments('guideline');
  const navigate = useNavigate();

  const handleDelete = (doc: KnowledgeDocument) => {
    deleteDocument(doc.id);
    notifications.show({ message: 'Рекомендация удалена', color: 'gray' });
  };

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
