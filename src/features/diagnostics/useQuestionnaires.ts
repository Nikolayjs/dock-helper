import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from '../../lib/httpRepository';
import type { Questionnaire } from './types';

const QUERY_KEY = ['diagnostic-questionnaires'];

export type QuestionnairePayload = Omit<Questionnaire, 'id' | 'createdAt' | 'updatedAt'>;

const repo = createHttpRepository<Questionnaire, QuestionnairePayload>('/questionnaires');

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
  const queryClient = useQueryClient();
  const { data: questionnaires = [], isLoading } = useQuery({ queryKey: QUERY_KEY, queryFn: repo.list });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY });

  const addQuestionnaireMutation = useMutation({
    mutationFn: (q: Questionnaire) => repo.create(toPayload(q)),
    onSuccess: invalidate,
  });

  const updateQuestionnaireMutation = useMutation({
    mutationFn: (q: Questionnaire) => repo.update(q.id, toPayload(q)),
    onSuccess: invalidate,
  });

  const deleteQuestionnaireMutation = useMutation({
    mutationFn: (id: string) => repo.remove(id),
    onSuccess: invalidate,
  });

  return {
    questionnaires,
    isLoading,
    addQuestionnaire: addQuestionnaireMutation.mutateAsync,
    updateQuestionnaire: updateQuestionnaireMutation.mutateAsync,
    deleteQuestionnaire: deleteQuestionnaireMutation.mutateAsync,
  };
}
