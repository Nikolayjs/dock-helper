export type KnowledgeKind = 'guideline' | 'article';

/**
 * Документ базы знаний в том объёме, в каком его отдаёт список.
 *
 * Без `content`, и это не экономия на спичках: тело документа в списке не показывается, а весит
 * почти весь ответ. Замер на справочнике из 210 рекомендаций — 517 КБ против 100 КБ, а запрос идёт
 * с каждой страницы базы знаний. Та же пара типов, что `DrugSummary` и `Drug` у формуляра.
 */
export interface KnowledgeDocumentSummary {
  id: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}

/** Полный документ: приходит только с `GET /knowledge-documents/:id`. */
export interface KnowledgeDocument extends KnowledgeDocumentSummary {
  content: string;
}
