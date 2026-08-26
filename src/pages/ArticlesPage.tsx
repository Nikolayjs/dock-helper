import { Container } from '@mantine/core';
import { IconArticle } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { KnowledgeGrid } from '../features/knowledgeBase/KnowledgeGrid';
import type { KnowledgeDocument } from '../features/knowledgeBase/types';
import { QUERY_KEY as KNOWLEDGE_KEY, useDocuments } from '../features/knowledgeBase/useDocuments';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

export function ArticlesPage() {
  const { documents, deleteDocument } = useDocuments('article');
  const confirmDelete = useDeleteWithConfirm();
  const navigate = useNavigate();

  const handleDelete = (doc: KnowledgeDocument) =>
    confirmDelete({
      what: 'статью',
      name: doc.title,
      notice: 'Статья удалена',
      queryKey: KNOWLEDGE_KEY,
      id: doc.id,
      perform: () => deleteDocument(doc.id),
    });

  return (
    <Container size="xl" px={0}>
      <KnowledgeGrid
        documents={documents}
        icon={IconArticle}
        addLabel="Добавить статью"
        emptyTitle="Пока нет статей"
        emptyText="Напишите клинический случай, обзор или конспект — сохранится с форматированием."
        searchPlaceholder="Поиск по статьям…"
        onAdd={() => navigate('/articles/new')}
        onOpen={(doc) => navigate(`/articles/${doc.id}`)}
        onEdit={(doc) => navigate(`/articles/${doc.id}/edit`)}
        onDelete={handleDelete}
        onTagClick={(tag) => navigate(`/knowledge/tag/${encodeURIComponent(tag)}`)}
      />
    </Container>
  );
}
