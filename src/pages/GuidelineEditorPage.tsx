import { KnowledgeEditorPage } from '../features/knowledgeBase/KnowledgeEditorPage';

export function GuidelineEditorPage() {
  return (
    <KnowledgeEditorPage
      kind="guideline"
      basePath="/guidelines"
      notFoundText="Рекомендация не найдена"
      backToListLabel="К списку рекомендаций"
      newTitle="Новая рекомендация"
      editTitle="Редактирование рекомендации"
      savedMessage="Изменения сохранены"
      createdMessage="Рекомендация добавлена"
    />
  );
}
