import { KnowledgeViewPage } from '../features/knowledgeBase/KnowledgeViewPage';

export function GuidelineViewPage() {
  return (
    <KnowledgeViewPage
      kind="guideline"
      basePath="/guidelines"
      notFoundText="Рекомендация не найдена"
      backLabel="К списку рекомендаций"
      deletedMessage="Рекомендация удалена"
    />
  );
}
