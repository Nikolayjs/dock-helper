import type { DiseaseSummary } from '../diseases/types';
import type { KnowledgeDocumentSummary } from '../knowledgeBase/types';
import type { ClipTarget } from './types';

/** Что нашлось по имени из заметки. */
export interface Mention {
  /** Как оно написано в заметке — по нему же и показывается. */
  name: string;
  /** Найденная запись; `null` — такой в справочнике нет. */
  found: { id: string; kind: 'disease' | 'article' | 'guideline'; title: string } | null;
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g;

/** Одно и то же ли это имя: регистр и «ё» различий не создают — как в вики-ссылках справочника. */
function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, 'е');
}

/**
 * Имена, которые врач назвал в заметке при сохранении.
 *
 * Расширение кладёт сюда `[[Название]]` — это его способ сказать «относится вот к этому», пока
 * страница ещё перед глазами. Разрешать их здесь обязательно: ссылка, которая никуда не ведёт и
 * никак не показана, — обещание, которого никто не выполнил, и лучше бы её тогда не вставлять.
 *
 * **Ненайденное остаётся в списке, а не выбрасывается.** Врач мог сохранить страницу до того, как
 * завёл нозологию; молча пропав, упоминание унесло бы с собой и его намерение.
 */
export function resolveMentions(
  note: string,
  diseases: DiseaseSummary[],
  documents: KnowledgeDocumentSummary[],
): Mention[] {
  const names = [...note.matchAll(WIKILINK_RE)].map((match) => match[1].trim()).filter(Boolean);
  if (names.length === 0) return [];

  const byDisease = new Map<string, DiseaseSummary>();
  for (const disease of diseases) {
    // Синоним ведёт туда же, куда название: расширение подсказывает и по нему.
    for (const alias of [disease.name, ...(disease.synonyms ?? [])]) {
      const key = normalize(alias);
      if (key && !byDisease.has(key)) byDisease.set(key, disease);
    }
  }
  const byDocument = new Map(documents.map((document) => [normalize(document.title), document]));

  const seen = new Set<string>();
  const mentions: Mention[] = [];
  for (const name of names) {
    const key = normalize(name);
    if (seen.has(key)) continue;
    seen.add(key);

    const disease = byDisease.get(key);
    if (disease) {
      mentions.push({ name, found: { id: disease.id, kind: 'disease', title: disease.name } });
      continue;
    }
    const document = byDocument.get(key);
    if (document) {
      mentions.push({ name, found: { id: document.id, kind: document.kind, title: document.title } });
      continue;
    }
    mentions.push({ name, found: null });
  }
  return mentions;
}

/**
 * Годится ли упоминание как место публикации этого клипа.
 *
 * Дописать статью можно в статью, нозологию — в нозологию: клип со страницы о болезни не должен
 * предлагать дописать себя в клиническую рекомендацию, которую синхронизация каталога потом
 * перестанет исправлять. У препарата упоминаний не бывает вовсе — подсказка их не ищет.
 */
export function isPublishTarget(mention: Mention, target: ClipTarget): boolean {
  if (!mention.found) return false;
  if (target === 'disease') return mention.found.kind === 'disease';
  if (target === 'article') return mention.found.kind === 'article';
  return false;
}
