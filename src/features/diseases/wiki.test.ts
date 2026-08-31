import { describe, expect, it } from 'vitest';

import { renderDiseaseWiki, type WikiIndex } from './wiki';
import type { DiseaseSummary } from './types';
import type { KnowledgeDocumentSummary } from '../knowledgeBase/types';
import type { Abbreviation } from '../abbreviations/types';

/**
 * Разрешение вики-ссылок в описании болезни.
 *
 * Проверяется не «работает ли замена» — проверяется, что ссылка ведёт **туда, куда обещает**, и что
 * непопадание видно. Справочник врача, молча проглатывающий опечатку в названии, обещает связь,
 * которой нет: на экране остаётся обычный текст, и узнать, что ссылка не сработала, нечем.
 */
const disease = (id: string, name: string, synonyms: string[] = []): DiseaseSummary =>
  ({
    id,
    name,
    synonyms,
    icdCodes: [],
    summary: '',
    category: '',
    guidelineKey: '',
    guidelineId: '',
    seedKey: '',
    hasDescription: false,
    createdAt: '',
    updatedAt: '',
  }) as DiseaseSummary;

const doc = (id: string, title: string, kind: KnowledgeDocumentSummary['kind']): KnowledgeDocumentSummary =>
  ({ id, title, kind, summary: '', tags: [], updatedAt: '' }) as unknown as KnowledgeDocumentSummary;

const index: WikiIndex = {
  diseases: [
    disease('d1', 'Фибрилляция предсердий', ['ФП', 'мерцалка']),
    disease('d2', 'Гипотиреоз'),
  ],
  documents: [doc('g1', 'Артериальная гипертензия у взрослых', 'guideline'), doc('a1', 'Разбор случая', 'article')],
  abbreviations: [{ id: 'ab1', short: 'ХОБЛ', full: 'Хроническая обструктивная болезнь лёгких' } as Abbreviation],
};

const render = (html: string) => renderDiseaseWiki(html, index);

describe('вики-ссылки в описании болезни', () => {
  it('ведёт на карточку болезни по названию', () => {
    expect(render('<p>см. [[Гипотиреоз]]</p>')).toContain('href="/reference/diseases/d2"');
  });

  it('находит болезнь по синониму — врач пишет так, как её называют в выписке', () => {
    const html = render('<p>[[мерцалка]]</p>');
    expect(html).toContain('href="/reference/diseases/d1"');
    expect(html).toContain('>мерцалка<');
  });

  it('подпись после «|» позволяет склонять название', () => {
    const html = render('<p>при [[Фибрилляция предсердий|фибрилляции предсердий]]</p>');
    expect(html).toContain('href="/reference/diseases/d1"');
    expect(html).toContain('>фибрилляции предсердий<');
  });

  it('код МКБ-10 ведёт в классификацию', () => {
    expect(render('[[I48.0]]')).toContain('href="/icd10/I48.0"');
    expect(render('[[e03]]')).toContain('href="/icd10/E03"');
  });

  it('различает рекомендацию и статью — это разные разделы', () => {
    expect(render('[[Артериальная гипертензия у взрослых]]')).toContain('href="/guidelines/g1"');
    expect(render('[[Разбор случая]]')).toContain('href="/articles/a1"');
  });

  it('сокращение показывает расшифровку, но ссылкой не притворяется', () => {
    const html = render('[[ХОБЛ]]');
    expect(html).toContain('<abbr title="Хроническая обструктивная болезнь лёгких">ХОБЛ</abbr>');
    expect(html).not.toContain('href');
  });

  it('ненайденное помечается, а не остаётся обычным текстом', () => {
    const html = render('[[Такой болезни нет]]');
    expect(html).toContain('wikilink-missing');
    expect(html).toContain('Такой болезни нет');
  });

  it('регистр и «ё» различий не создают', () => {
    expect(render('[[гипотиреоз]]')).toContain('href="/reference/diseases/d2"');
  });

  it('экранирует подпись: имя из чужого текста не должно ломать разметку', () => {
    const html = render('[[Гипотиреоз|<b>жирным</b>]]');
    expect(html).not.toContain('<b>жирным</b>');
    expect(html).toContain('&lt;b&gt;');
  });

  it('не трогает обычный текст и одиночные скобки', () => {
    expect(render('<p>норма [0–1] и [[]]</p>')).toBe('<p>норма [0–1] и [[]]</p>');
  });
});
