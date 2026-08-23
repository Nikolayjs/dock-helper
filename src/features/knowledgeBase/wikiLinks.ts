import { stripHtml } from '../notes/textPreview';
import type { KnowledgeDocument } from './types';

const WIKILINK_RE = /\[\[([^\]]+)\]\]/g;

/** Extracts the titles referenced via `[[Title]]` wiki-link syntax in a document's HTML content. */
export function extractWikiLinkTitles(html: string): string[] {
  const text = stripHtml(html);
  const titles: string[] = [];
  for (const match of text.matchAll(WIKILINK_RE)) {
    const title = match[1].trim();
    if (title) titles.push(title);
  }
  return titles;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function basePathForKind(kind: KnowledgeDocument['kind']): string {
  return kind === 'guideline' ? '/guidelines' : '/articles';
}

/** Replaces `[[Title]]` occurrences in HTML content with clickable links to the matching document. */
export function renderWikiLinks(html: string, allDocuments: KnowledgeDocument[]): string {
  const byTitle = new Map(allDocuments.map((doc) => [doc.title.trim().toLowerCase(), doc]));
  return html.replace(WIKILINK_RE, (full, rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title) return full;
    const target = byTitle.get(title.toLowerCase());
    if (!target) return `<span class="wikilink-missing" title="Заметка не найдена">[[${escapeHtml(title)}]]</span>`;
    const path = `${basePathForKind(target.kind)}/${target.id}`;
    return `<a href="${path}" data-doc-link="${target.id}" class="wikilink">${escapeHtml(target.title)}</a>`;
  });
}
