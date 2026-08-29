import { createCrudResource, useCrudResource } from '../../lib/createCrudResource';
import type { Questionnaire } from './types';

/** Кэш, которым владеет этот хук. Экспортируется, чтобы удаление могло спрятать строку на время отмены. */
export const QUERY_KEY = ['diagnostic-questionnaires'];

export type QuestionnairePayload = Omit<Questionnaire, 'id' | 'createdAt' | 'updatedAt'>;

const resource = createCrudResource<Questionnaire, QuestionnairePayload>('/questionnaires', QUERY_KEY);

function toPayload(questionnaire: Questionnaire): QuestionnairePayload {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...payload } = questionnaire;
  return payload;
}

export function slugifyQuestionnaireId(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
  return `${base || 'questionnaire'}-${Date.now().toString(36)}`;
}

export function useQuestionnaires() {
  const { items, isLoading, error, refetch, create, update, remove } = useCrudResource(resource);

  return {
    questionnaires: items,
    isLoading,
    error,
    refetch,
    addQuestionnaire: (q: Questionnaire) => create(toPayload(q)),
    updateQuestionnaire: (q: Questionnaire) => update(q.id, toPayload(q)),
    deleteQuestionnaire: remove,
  };
}
