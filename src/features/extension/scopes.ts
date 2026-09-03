import type { ExtensionScope, ExtensionTokenView } from './useExtensionTokens';

/**
 * Что расширению позволено. Названо словами врача, а не идентификаторами скоупов: «clips:write» ни
 * о чём не говорит тому, кто нажимает кнопку.
 *
 * Список **растёт**, и в этом всё дело: токен несёт те скоупы, что были при выпуске, а не те, что
 * есть сейчас. Отсюда `missingScopes` — без него старый токен молча не делал бы нового, и выглядело
 * бы это как сломавшееся расширение.
 */
export const SCOPES: { value: ExtensionScope; label: string }[] = [
  { value: 'clips:write', label: 'Сохранять страницы' },
  { value: 'catalog:read', label: 'Подсказывать названия из справочников' },
  { value: 'sources:write', label: 'Добавлять ленты новостей и книги по ссылке' },
];

/** Чего этот токен не умеет. У отозванного не спрашивается: он не умеет ничего. */
export function missingScopes(token: Pick<ExtensionTokenView, 'scopes' | 'revokedAt'>): string[] {
  if (token.revokedAt) return [];
  return SCOPES.filter((scope) => !token.scopes.includes(scope.value)).map((scope) => scope.label.toLowerCase());
}
