import { describe, expect, it } from 'vitest';

import { isPublishTarget, resolveMentions } from './mentions';
import type { DiseaseSummary } from '../diseases/types';
import type { KnowledgeDocumentSummary } from '../knowledgeBase/types';

const diseases = [
  { id: 'd1', name: 'Внебольничная пневмония', synonyms: ['воспаление лёгких'] },
  { id: 'd2', name: 'Фибрилляция предсердий', synonyms: ['мерцалка'] },
] as unknown as DiseaseSummary[];

const documents = [
  { id: 'k1', title: 'Разбор случая: одышка', kind: 'article' },
  { id: 'k2', title: 'Пневмония: ведение', kind: 'article' },
] as unknown as KnowledgeDocumentSummary[];

const resolve = (note: string) => resolveMentions(note, diseases, documents);

describe('упоминания из заметки', () => {
  it('находит болезнь по названию', () => {
    expect(resolve('дополнить [[Внебольничная пневмония]]')[0].found).toMatchObject({ id: 'd1', kind: 'disease' });
  });

  it('находит по синониму — расширение подсказывает и по нему', () => {
    expect(resolve('[[мерцалка]]')[0].found).toMatchObject({ id: 'd2', title: 'Фибрилляция предсердий' });
  });

  it('находит документ базы знаний', () => {
    expect(resolve('[[Разбор случая: одышка]]')[0].found).toMatchObject({ id: 'k1', kind: 'article' });
  });

  it('регистр и «ё» различий не создают', () => {
    expect(resolve('[[ВОСПАЛЕНИЕ ЛЕГКИХ]]')[0].found).toMatchObject({ id: 'd1' });
  });

  it('подпись после «|» именем не считается', () => {
    expect(resolve('[[Внебольничная пневмония|пневмонии]]')[0].found).toMatchObject({ id: 'd1' });
  });

  /*
   * Врач мог сохранить страницу до того, как завёл нозологию. Молча пропав, упоминание унесло бы с
   * собой и его намерение — а показанное «не нашлось» подсказывает, что запись стоит завести.
   */
  it('ненайденное остаётся в списке', () => {
    const [mention] = resolve('[[Такой болезни нет]]');
    expect(mention.name).toBe('Такой болезни нет');
    expect(mention.found).toBeNull();
  });

  it('одно и то же имя дважды не показывается', () => {
    expect(resolve('[[мерцалка]] и ещё раз [[Мерцалка]]')).toHaveLength(1);
  });

  it('в заметке без ссылок ничего не находит', () => {
    expect(resolve('просто заметка')).toEqual([]);
    expect(resolve('')).toEqual([]);
  });
});

describe('куда можно дописать', () => {
  const disease = resolve('[[мерцалка]]')[0];
  const article = resolve('[[Разбор случая: одышка]]')[0];

  it('нозология — в нозологию, статья — в статью', () => {
    expect(isPublishTarget(disease, 'disease')).toBe(true);
    expect(isPublishTarget(article, 'article')).toBe(true);
  });

  it('перепутать виды нельзя', () => {
    expect(isPublishTarget(disease, 'article')).toBe(false);
    expect(isPublishTarget(article, 'disease')).toBe(false);
  });

  it('ненайденное местом публикации не бывает', () => {
    expect(isPublishTarget(resolve('[[Нет такого]]')[0], 'disease')).toBe(false);
  });

  it('у препарата упоминания местом публикации не служат', () => {
    expect(isPublishTarget(disease, 'drug')).toBe(false);
  });
});
