/**
 * Turns an analyte name read out of a file into a parameter key.
 *
 * Keys are C-style identifiers — the builder validates them against that, and the pattern engine
 * addresses parameters by key — while the names in a lab report are Russian. Transliterating keeps
 * the key legible to whoever later writes a pattern rule, which `param_3` would not be.
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

const MAX_KEY_LENGTH = 40;

function transliterate(text: string): string {
  return [...text.toLowerCase()].map((char) => CYRILLIC_TO_LATIN[char] ?? char).join('');
}

/**
 * @param taken keys already in use; a suffix is appended rather than silently colliding, because
 *   two parameters sharing a key would make the second invisible to the analyzer engine.
 */
export function toParamKey(name: string, taken: Set<string>): string {
  let key = transliterate(name)
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, MAX_KEY_LENGTH)
    .replace(/_+$/, '');

  // Identifiers cannot open with a digit, and an all-punctuation name reduces to nothing at all.
  if (!key || /^[0-9]/.test(key)) key = `p_${key}`;

  let unique = key;
  for (let suffix = 2; taken.has(unique); suffix++) unique = `${key}_${suffix}`;
  taken.add(unique);
  return unique;
}
