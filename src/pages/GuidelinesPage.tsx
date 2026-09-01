import { Container } from '@mantine/core';
import { useNavigate } from 'react-router-dom';

import { GuidelinesCatalog } from '../features/knowledgeBase/GuidelinesCatalog';
import type { KnowledgeDocumentSummary } from '../features/knowledgeBase/types';
import { QUERY_KEY as KNOWLEDGE_KEY, useDocuments } from '../features/knowledgeBase/useDocuments';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

export function GuidelinesPage() {
  const { documents, deleteDocument } = useDocuments('guideline');
  const confirmDelete = useDeleteWithConfirm();
  const navigate = useNavigate();

  const handleDelete = (doc: KnowledgeDocumentSummary) =>
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
      <GuidelinesCatalog
        documents={documents}
        onAdd={() => navigate('/guidelines/new')}
        onOpen={(doc) => navigate(`/guidelines/${doc.id}`)}
        onEdit={(doc) => navigate(`/guidelines/${doc.id}/edit`)}
        onDelete={handleDelete}
        onTagClick={(tag) => navigate(`/knowledge/tag/${encodeURIComponent(tag)}`, { state: { from: '/guidelines' } })}
      />
    </Container>
  );
}
