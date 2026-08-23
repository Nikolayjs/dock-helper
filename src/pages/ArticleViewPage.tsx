import { KnowledgeViewPage } from '../features/knowledgeBase/KnowledgeViewPage';

export function ArticleViewPage() {
  return (
    <KnowledgeViewPage
      kind="article"
      basePath="/articles"
      notFoundText="Статья не найдена"
      backLabel="К списку статей"
      deletedMessage="Статья удалена"
    />
  );
}
