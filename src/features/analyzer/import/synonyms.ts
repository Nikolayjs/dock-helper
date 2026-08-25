/**
 * Names the same analyte is printed under by different laboratories.
 *
 * These are not spelling variants that fuzzy matching would forgive — `АЛТ` and `АлАТ` differ by
 * one character out of three or four, which is far too close to the distance between genuinely
 * different analytes to accept as a typo. They are simply two accepted abbreviations for
 * аланинаминотрансфераза, and only a list can say so.
 *
 * Shipped in code rather than seeded into each workspace's analyzers, so the knowledge reaches
 * every installation at once and applies to analyzers the doctor wrote themselves. Anything local
 * or unusual belongs in a parameter's own `aliases` instead.
 */

const SYNONYM_GROUPS: string[][] = [
  ['алт', 'алат', 'аланинаминотрансфераза', 'alt', 'gpt'],
  ['аст', 'асат', 'аспартатаминотрансфераза', 'ast', 'got'],
  ['ггт', 'ггтп', 'гамма глутамилтрансфераза', 'ggt'],
  ['щелочная фосфатаза', 'щф', 'alp'],
  ['с реактивный белок', 'срб', 'crp'],
  ['общий билирубин', 'билирубин общий', 'общ билирубин'],
  ['прямой билирубин', 'билирубин прямой', 'связанный билирубин'],
  ['общий холестерин', 'холестерин', 'холестерин общий', 'охс'],
  ['общий белок', 'белок общий'],
  ['мочевая кислота', 'мк'],
  ['гемоглобин', 'hgb', 'hb'],
  ['эритроциты', 'rbc'],
  ['лейкоциты', 'wbc'],
  ['тромбоциты', 'plt'],
  ['гематокрит', 'hct'],
  ['соэ', 'esr'],
  ['глюкоза', 'глюкоза натощак', 'glu'],
  ['креатинин', 'crea'],
  ['мочевина', 'urea'],
  ['триглицериды', 'тг'],
  ['кальций общий', 'общий кальций', 'кальций'],
  ['лимфоциты', 'lym'],
  ['нейтрофилы', 'neu'],
  ['моноциты', 'mon'],
  ['эозинофилы', 'eos'],
  ['базофилы', 'bas'],
];

const BY_NAME = new Map<string, string[]>();
for (const group of SYNONYM_GROUPS) {
  for (const name of group) BY_NAME.set(name, group);
}

/** The group `name` belongs to, or just `name` when it is not a known synonym. */
export function expandSynonyms(name: string): string[] {
  return BY_NAME.get(name) ?? [name];
}
