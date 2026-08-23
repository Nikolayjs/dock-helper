import { KnowledgeEditorPage } from '../features/knowledgeBase/KnowledgeEditorPage';

export function ArticleEditorPage() {
  return (
    <KnowledgeEditorPage
      kind="article"
      basePath="/articles"
      notFoundText="Статья не найдена"
      backToListLabel="К списку статей"
      newTitle="Новая статья"
      editTitle="Редактирование статьи"
      savedMessage="Изменения сохранены"
      createdMessage="Статья добавлена"
    />
  );
}
