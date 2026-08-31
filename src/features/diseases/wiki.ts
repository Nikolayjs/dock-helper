import { escapeHtml } from '../../lib/escapeHtml';
import type { Abbreviation } from '../abbreviations/types';
import type { KnowledgeDocumentSummary } from '../knowledgeBase/types';
import type { DiseaseSummary } from './types';

/**
 * Вики-ссылки в описании болезни: `[[Название]]` и `[[Название|как показать]]`.
 *
 * Врач приходит в справочник за **полной** картиной, а полная картина всегда состоит из чужих
 * кусков: рядом с описанием стоят другая нозология, код МКБ-10, клиническая рекомендация и
 * сокращение из чужой выписки. Пересказывать их здесь значило бы завести второй источник, который
 * разойдётся с первым при первой же правке, — поэтому справочник **ссылается**, а не пересказывает.
 * Ровно тем же живёт база знаний, откуда синтаксис и взят.
 *
 * Разрешается ссылка по порядку: код МКБ-10 → болезнь (по названию или синониму) → документ базы
 * знаний → сокращение. Порядок не произволен: код узнаётся по форме и ни с чем не путается, а
 * дальше идёт то, ради чего раздел и заводился.
 *
 * **Ненайденное помечается красным, а не остаётся текстом.** Вики, молча проглатывающая опечатку в
 * названии, обещает связь, которой нет: врач видит обычный текст и не узнаёт, что ссылка не
 * сработала. Та же причина, по которой отбор в справочниках честно говорит, сколько записей он
 * спрятал.
 *
 * Сокращение — не ссылка, а подсказка: отдельной страницы у него нет, и вести на список, где надо
 * ещё раз искать глазами, значило бы обещать больше, чем даёшь. Расшифровка показывается наведением
 * и остаётся в разметке для того, кто читает с экранного диктора.
 */
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** `I10`, `I21.0` — форма кода МКБ-10. Буква латинская: в классификации русских букв нет. */
const ICD_CODE_RE = /^[A-Z]\d{2}(\.\d{1,2})?$/;

export interface WikiIndex {
  diseases: DiseaseSummary[];
  documents: KnowledgeDocumentSummary[];
  abbreviations: Abbreviation[];
}

/** Одно и то же ли это имя: регистр и «ё» различий не создают. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

function link(href: string, text: string): string {
  return `<a href="${href}" data-wiki-link="1" class="wikilink">${escapeHtml(text)}</a>`;
}

export function renderDiseaseWiki(html: string, index: WikiIndex): string {
  const byDisease = new Map<string, DiseaseSummary>();
  for (const disease of index.diseases) {
    // Синоним ведёт туда же, куда название: врач пишет так, как болезнь называют в выписке.
    for (const name of [disease.name, ...disease.synonyms]) {
      const key = normalize(name);
      if (key && !byDisease.has(key)) byDisease.set(key, disease);
    }
  }
  const byDocument = new Map(index.documents.map((doc) => [normalize(doc.title), doc]));
  const byAbbreviation = new Map(index.abbreviations.map((row) => [normalize(row.short), row]));

  return html.replace(WIKILINK_RE, (full, raw: string) => {
    const [rawTarget, rawLabel] = raw.split('|');
    const target = rawTarget.trim();
    // Подпись позволяет склонять: «при [[Фибрилляция предсердий|фибрилляции предсердий]]».
    const label = (rawLabel ?? rawTarget).trim();
    if (!target) return full;

    const code = target.toUpperCase();
    if (ICD_CODE_RE.test(code)) return link(`/icd10/${code}`, label);

    const disease = byDisease.get(normalize(target));
    if (disease) return link(`/reference/diseases/${disease.id}`, label);

    const doc = byDocument.get(normalize(target));
    if (doc) return link(`${doc.kind === 'guideline' ? '/guidelines' : '/articles'}/${doc.id}`, label);

    const abbreviation = byAbbreviation.get(normalize(target));
    if (abbreviation) {
      return `<abbr title="${escapeHtml(abbreviation.full)}">${escapeHtml(label)}</abbr>`;
    }

    return `<span class="wikilink-missing" title="В справочнике этого нет">${escapeHtml(label)}</span>`;
  });
}
