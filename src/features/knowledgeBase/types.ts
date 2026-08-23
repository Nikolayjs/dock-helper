export type KnowledgeKind = 'guideline' | 'article';

export interface KnowledgeDocument {
  id: string;
  kind: KnowledgeKind;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
}
