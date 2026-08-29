import { buildDrugIndex, drugNameOptions, normalizeDrugName, resolveDrug } from '../drugs/drugIndex';
import type { DrugIndex, ResolvedDrug } from '../drugs/drugIndex';
import type { DrugSummary } from '../drugs/types';
import { componentsOf, isLocalRoute, matchKeysFor } from './combinations';
import { SEVERITY_RANK } from './types';
import type { DrugInteraction } from './types';

/**
 * The interaction check runs on МНН, and the doctor types whatever the patient said. Everything
 * here goes through the drug directory first (see `features/drugs/drugIndex`) so «Нурофен» and
 * «Ибупрофен» are one drug rather than two unrelated strings.
 *
 * A drug the directory does not know still works: it is matched on the text as typed, so the check
 * never becomes *less* capable than the directory is complete.
 *
 * Комбинация участвует и по своим компонентам — см. `combinations.ts`: правило пишется на одно МНН,
 * а пациент приносит «Ибуклин».
 */

export { buildDrugIndex };
export type { DrugIndex, ResolvedDrug };

/**
 * Names to offer in the picker: the whole formulary — МНН and trade names alike — plus any drug a
 * rule mentions that has no directory entry yet, so no existing rule becomes unreachable.
 */
export function getKnownDrugNames(drugs: DrugSummary[], interactions: DrugInteraction[]): string[] {
  const names = drugNameOptions(drugs);
  const known = new Set(names.map(normalizeDrugName));
  const index = buildDrugIndex(drugs);

  for (const interaction of interactions) {
    for (const name of [interaction.drugA, interaction.drugB]) {
      const key = normalizeDrugName(name);
      if (!key || known.has(key) || index.innByName.has(key)) continue;
      known.add(key);
      names.push(name.trim());
    }
  }

  return names.sort((a, b) => a.localeCompare(b, 'ru'));
}

export interface MatchedInteraction {
  interaction: DrugInteraction;
  /** The entry from the doctor's list that matched `interaction.drugA`, resolved to its МНН. */
  a: ResolvedDrug;
  b: ResolvedDrug;
  /** Компонент комбинации, по которому сработало правило, — пусто, если сработал сам препарат. */
  viaA?: string;
  viaB?: string;
}

/** Введённый препарат вместе с МНН, по которым он участвует в проверке. */
interface EnteredDrug {
  resolved: ResolvedDrug;
  keys: string[];
}

function enteredDrugs(entered: string[], index: DrugIndex): EnteredDrug[] {
  const byInn = new Map<string, EnteredDrug>();
  for (const name of entered) {
    const resolved = resolveDrug(name, index);
    if (!resolved.inn) continue;
    // Keep the first mention: it is the name the doctor reached for, and the alert echoes it back.
    if (byInn.has(resolved.inn)) continue;
    byInn.set(resolved.inn, { resolved, keys: matchKeysFor(resolved.inn, resolved.drug) });
  }
  return [...byInn.values()];
}

/**
 * Каждому МНН — препарат из списка врача, который по нему участвует.
 *
 * Своё МНН важнее компонентного притязания: если врач ввёл и «Нурофен», и «Ибуклин», ибупрофеновое
 * правило должно назваться ибупрофеном, а не комбинацией.
 */
function keyOwners(list: EnteredDrug[]): Map<string, EnteredDrug> {
  const byKey = new Map<string, EnteredDrug>();
  for (const item of list) byKey.set(item.resolved.inn, item);
  for (const item of list) {
    for (const key of item.keys) if (!byKey.has(key)) byKey.set(key, item);
  }
  return byKey;
}

/**
 * Pairwise-matches the doctor's list against every known rule, order-independent.
 *
 * Duplicates collapse: entering both «Нурофен» and «Ибупрофен» is one drug, not a pair, and
 * reporting the same ibuprofen rule twice would make a real warning look like noise. По той же
 * причине правило показывается один раз, даже если совпало сразу двумя путями — скажем, когда в
 * списке есть и «Нурофен», и «Ибуклин».
 *
 * Правило между двумя компонентами **одного** препарата пропускается (`a === b`): это одна и та же
 * запись из списка, и предупреждать о взаимодействии таблетки с самой собой не о чем.
 */
export function checkInteractions(
  entered: string[],
  interactions: DrugInteraction[],
  index: DrugIndex,
): MatchedInteraction[] {
  const list = enteredDrugs(entered, index);
  const byKey = keyOwners(list);

  const matches: MatchedInteraction[] = [];
  const seen = new Set<string>();
  for (const interaction of interactions) {
    const keyA = resolveDrug(interaction.drugA, index).inn;
    const keyB = resolveDrug(interaction.drugB, index).inn;
    const a = byKey.get(keyA);
    const b = byKey.get(keyB);
    if (!a || !b || a === b || seen.has(interaction.id)) continue;
    seen.add(interaction.id);
    matches.push({
      interaction,
      a: a.resolved,
      b: b.resolved,
      viaA: a.resolved.inn === keyA ? undefined : interaction.drugA,
      viaB: b.resolved.inn === keyB ? undefined : interaction.drugB,
    });
  }

  return matches.sort((x, y) => SEVERITY_RANK[x.interaction.severity] - SEVERITY_RANK[y.interaction.severity]);
}

export interface SharedComponent {
  /** Общее действующее вещество — в написании справочника, если карточка для него есть. */
  component: string;
  /** Препараты из списка врача, в которых оно есть. */
  drugs: ResolvedDrug[];
}

/**
 * Одно и то же вещество, попавшее в список дважды разными препаратами.
 *
 * Это не взаимодействие, а удвоение дозы, и находится оно тем же раскрытием состава. Самый частый
 * случай — парацетамол: он в «Пенталгине», в «Терафлю», в «Колдрексе» и ещё в десятке порошков «от
 * простуды», которые пациент лекарством не считает. Ровно так и набирается доза, гепатотоксичная
 * при полном соблюдении инструкции к каждой упаковке по отдельности; про это прямо написано в
 * примечании к карточке парацетамола. Второй по частоте — два НПВС сразу.
 *
 * Ищется по списку врача, а не по правилам: правила тут ни при чём, вещество просто названо дважды.
 */
export function findSharedComponents(entered: string[], index: DrugIndex): SharedComponent[] {
  const list = enteredDrugs(entered, index);
  const byKey = new Map<string, EnteredDrug[]>();
  for (const item of list) {
    for (const key of item.keys) {
      const bucket = byKey.get(key);
      if (bucket) bucket.push(item);
      else byKey.set(key, [item]);
    }
  }

  const shared: SharedComponent[] = [];
  for (const [key, items] of byKey) {
    if (items.length < 2) continue;
    const card = index.byInn.get(key);
    shared.push({
      component: card ? card.inn : key.charAt(0).toUpperCase() + key.slice(1),
      drugs: items.map((item) => item.resolved),
    });
  }
  return shared.sort(
    (a, b) => b.drugs.length - a.drugs.length || a.component.localeCompare(b.component, 'ru'),
  );
}

/** The doctor's list, resolved — drives the "what this was understood as" line under the picker. */
export function resolveEnteredDrugs(entered: string[], index: DrugIndex): ResolvedDrug[] {
  return entered.map((name) => resolveDrug(name, index));
}

/** МНН, под которыми препарат встречается в правилах: он сам и компоненты системной комбинации. */
function ruleKeysFor(drug: DrugSummary): Set<string> {
  const own = normalizeDrugName(drug.inn);
  if (isLocalRoute(drug.atcCode)) return new Set([own]);
  return new Set([own, ...componentsOf(drug.inn)]);
}

/** Rules that mention this drug — shown on its card in the directory. */
export function interactionsForDrug(
  drug: DrugSummary,
  interactions: DrugInteraction[],
  index: DrugIndex,
): DrugInteraction[] {
  const keys = ruleKeysFor(drug);
  return interactions
    .filter((interaction) => {
      const a = resolveDrug(interaction.drugA, index).inn;
      const b = resolveDrug(interaction.drugB, index).inn;
      // Правило между двумя компонентами самой комбинации — не про взаимодействие с чем-то ещё.
      if (keys.has(a) && keys.has(b)) return false;
      return keys.has(a) || keys.has(b);
    })
    .sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity]);
}

/** The other drug in a rule, given one side of it. */
export function otherDrugIn(interaction: DrugInteraction, drug: DrugSummary, index: DrugIndex): string {
  const keys = ruleKeysFor(drug);
  return keys.has(resolveDrug(interaction.drugA, index).inn) ? interaction.drugB : interaction.drugA;
}
