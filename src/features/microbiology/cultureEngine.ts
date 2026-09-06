import type {
  Antibiotic,
  ClinicalRule,
  ContextFlag,
  CultureReport,
  IntrinsicRule,
  Isolate,
  Locus,
  MicrobiologyReference,
  Organism,
  PhenotypeRule,
  Severity,
  Significance,
  SusceptibilityEntry,
} from './types';

/**
 * Разбор посева с антибиотикограммой.
 *
 * Движок отвечает на три вопроса, и они разные:
 *
 * 1. **Значим ли рост.** Тот же микроб в одном материале — норма, в другом — возбудитель, а порог
 *    зависит ещё и от жалоб и от того, как взята моча. Ответ «в моче выросла кишечная палочка»
 *    сам по себе не значит ничего.
 * 2. **Не врёт ли бланк.** Природная устойчивость — свойство вида, и «чувствителен» напротив
 *    такой пары означает ошибку лаборатории, а не удачу; фенотип вроде MRSA отменяет разом два
 *    десятка строк, у части которых напечатано «чувствителен».
 * 3. **Лечить ли вообще.** На этот вопрос антибиотикограмма не отвечает никогда, а он чаще
 *    главный: бессимптомная бактериурия лечения не требует ни при каком счёте.
 *
 * Считается это **на клиенте, пока врач печатает**, — ровно как разбор анализа: справочник
 * приезжает один раз и лежит в кэше весь сеанс.
 */

/** Что стало с одним препаратом бланка. */
export interface DrugVerdict {
  antibiotic?: Antibiotic;
  /** Как напечатано в бланке, когда препарат не опознан. */
  label: string;
  entry: SusceptibilityEntry;
  /** Почему препарат не годится, вопреки написанному в бланке. */
  suppressedBy?: { kind: 'intrinsic' | 'phenotype' | 'locus'; why: string };
  /** Оговорка, не отменяющая препарат: «только в высокой дозе», «только при цистите». */
  caution?: string;
}

/** Строка бланка, противоречащая природной устойчивости: лаборатория написала «чувствителен» там, где не бывает. */
export interface Conflict {
  label: string;
  result: 'S' | 'I';
  why: string;
  ruleId: string;
}

export interface IsolateVerdict {
  isolate: Isolate;
  organism?: Organism;
  /** Как назвать находку в заголовке карточки. */
  label: string;
  significance: Significance;
  /** Почему именно такая значимость — печатается под заголовком. */
  why: string;
  /** Порог, по которому судили, и откуда он взялся. */
  threshold?: { lg: number; why: string };
  phenotypes: PhenotypeRule[];
  conflicts: Conflict[];
  /** Годные препараты, от узких к широким. */
  options: DrugVerdict[];
  /** Не годятся, хотя в бланке «чувствителен». */
  suppressed: DrugVerdict[];
  /** Устойчив по бланку. */
  resistant: DrugVerdict[];
  notes: ClinicalRule[];
}

export interface CultureVerdict {
  locus?: Locus;
  isolates: IsolateVerdict[];
  /** Выводы про бланк целиком. */
  notes: ClinicalRule[];
  /** Есть ли хоть одна значимая находка — этим страница решает, что показывать первым. */
  anySignificant: boolean;
}

const SIGNIFICANT: Significance[] = ['pathogen', 'significant'];

/** Степень роста в КОЕ не переводится: III–IV — «много», I–II — «мало». Точность здесь была бы выдумкой. */
function degreeIsHeavy(degree?: number): boolean | undefined {
  if (degree === undefined) return undefined;
  return degree >= 3;
}

function matchesOrganism(rule: { groups?: string[]; organisms?: string[] }, organism: Organism): boolean {
  const byGroup = rule.groups?.includes(organism.group) ?? false;
  const byName = rule.organisms?.includes(organism.key) ?? false;
  if (!rule.groups && !rule.organisms) return true;
  return byGroup || byName;
}

/**
 * Действует ли правило природной устойчивости на эту пару.
 *
 * Экспортируется, потому что тем же вопросом задаётся карточка возбудителя в справочнике: «к чему
 * он устойчив от природы» — это и есть перебор пар этой функцией. Своя копия там разошлась бы с
 * движком на первой правке, и справочник начал бы обещать не то, что скажет разбор бланка.
 */
export function intrinsicHit(rule: IntrinsicRule, organism: Organism, antibiotic: Antibiotic): boolean {
  if (rule.exceptOrganisms?.includes(organism.key)) return false;
  if (!matchesOrganism(rule, organism)) return false;
  if (rule.exceptAntibiotics?.includes(antibiotic.key)) return false;
  const byClass = rule.classes?.includes(antibiotic.klass) ?? false;
  const byName = rule.antibiotics?.includes(antibiotic.key) ?? false;
  return byClass || byName;
}

function phenotypeHit(rule: PhenotypeRule, organism: Organism, results: Map<string, string>): boolean {
  if (!matchesOrganism(rule, organism)) return false;
  return rule.when.every((cond) => {
    const seen = cond.antibiotics.map((key) => results.get(key)).filter((r): r is string => r !== undefined);
    // Условие о препаратах, которых в бланке нет вовсе, не выполнено: вывод из отсутствующей
    // строки был бы выводом ни из чего — то же правило, что у незаполненного показателя анализа.
    if (seen.length === 0) return false;
    return cond.mode === 'all' ? seen.every((r) => r === cond.is) : seen.some((r) => r === cond.is);
  });
}

/**
 * Порог значимости: берётся **наименьший** из подошедших.
 *
 * Направление выбрано сознательно. Ошибиться можно в обе стороны, но цена разная: завышенный порог
 * прячет настоящую инфекцию (женщина с циститом и ростом 10³ получает «роста нет»), заниженный —
 * добавляет строку «рост значим», которую врач всё равно читает вместе с жалобами. Какое правило
 * дало порог, говорится вслух: без этого «10²» выглядит опечаткой.
 */
function thresholdFor(locus: Locus, organism: Organism | undefined, context: ContextFlag[]) {
  const candidates: { lg: number; why: string }[] = [];
  if (locus.threshold !== undefined) {
    candidates.push({ lg: locus.threshold, why: `обычный порог значимости для этого материала — 10${sup(locus.threshold)} КОЕ/мл` });
  }
  for (const t of locus.thresholds ?? []) {
    if (!organism) continue;
    const byGroup = t.groups?.includes(organism.group) ?? false;
    const byName = t.organisms?.includes(organism.key) ?? false;
    if (byGroup || byName) candidates.push({ lg: t.lg, why: t.why });
  }
  for (const t of locus.contextThresholds ?? []) {
    if (context.includes(t.when)) candidates.push({ lg: t.lg, why: t.why });
  }
  if (candidates.length === 0) return undefined;
  return candidates.reduce((best, c) => (c.lg < best.lg ? c : best));
}

/** Надстрочная запись показателя степени: 10⁵ читается быстрее, чем «10^5». */
export function sup(n: number): string {
  const digits = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  return String(n)
    .split('')
    .map((ch) => (ch >= '0' && ch <= '9' ? digits[Number(ch)] : ch))
    .join('');
}

function significanceOf(
  locus: Locus | undefined,
  organism: Organism | undefined,
  isolate: Isolate,
  context: ContextFlag[],
): { significance: Significance; why: string; threshold?: { lg: number; why: string } } {
  if (!organism) {
    return {
      significance: 'unknown',
      why: 'Возбудитель не опознан справочником: значимость роста, природную устойчивость и ловушки бланка проверить нечем. Выберите его из списка или сверьтесь с лабораторией — в бланке род обычно сокращён.',
    };
  }
  if (!locus) {
    return { significance: 'unknown', why: 'Не выбран материал, а значимость роста определяется прежде всего им.' };
  }

  if (locus.pathogens?.includes(organism.key)) {
    return {
      significance: 'pathogen',
      why: `В этом материале ${organism.ru.toLowerCase()} — безусловный возбудитель: порога у него нет, значим любой рост, включая скудный.`,
    };
  }

  if (locus.sterile) {
    if (locus.contaminants?.includes(organism.key)) {
      return {
        significance: 'contaminant',
        why: 'Материал стерилен, но этот микроб живёт на коже и чаще всего попадает в пробу при заборе. Различает возбудителя и занос не сам микроб, а число положительных проб из разных мест.',
      };
    }
    return { significance: 'pathogen', why: 'Материал стерилен: любой рост значим.' };
  }

  if (locus.flora.includes(organism.key)) {
    return {
      significance: 'flora',
      why: `В этом материале ${organism.ru.toLowerCase()} — нормальный обитатель, а не находка. Сам по себе рост диагнозом не является: решают жалобы и микроскопия, а не бланк.`,
    };
  }

  if (locus.contaminants?.includes(organism.key)) {
    return {
      significance: 'contaminant',
      why: 'Обычно попадает в пробу при заборе, а не растёт из очага. Прежде чем лечить, стоит пересдать анализ с соблюдением техники.',
    };
  }

  const threshold = thresholdFor(locus, organism, context);
  if (!threshold) {
    return {
      significance: 'significant',
      why: 'Для этого материала порога в КОЕ нет: возбудитель здесь не относится ни к нормальной флоре, ни к обычным контаминантам.',
    };
  }

  if (isolate.lgCfu !== undefined) {
    if (isolate.lgCfu >= threshold.lg) {
      return {
        significance: 'significant',
        why: `Рост 10${sup(isolate.lgCfu)} КОЕ/мл достигает порога 10${sup(threshold.lg)} — ${threshold.why}.`,
        threshold,
      };
    }
    return {
      significance: 'below-threshold',
      why: `Рост 10${sup(isolate.lgCfu)} КОЕ/мл ниже порога 10${sup(threshold.lg)} — ${threshold.why}. Ниже порога это чаще загрязнение при заборе, чем инфекция; при стойких жалобах анализ пересдают.`,
      threshold,
    };
  }

  const heavy = degreeIsHeavy(isolate.growthDegree);
  if (heavy === true) {
    return {
      significance: 'significant',
      why: `Обильный рост. Точного числа лаборатория не дала, а порог для этого материала — 10${sup(threshold.lg)} КОЕ/мл: обильный рост его превышает, но переводить степень в КОЕ точно нельзя.`,
      threshold,
    };
  }
  if (heavy === false) {
    return {
      significance: 'below-threshold',
      why: `Скудный рост при пороге 10${sup(threshold.lg)} КОЕ/мл. Степень роста в КОЕ переводится лишь приблизительно, поэтому при стойких жалобах это не отказ, а повод пересдать.`,
      threshold,
    };
  }

  return {
    significance: 'unknown',
    why: `Лаборатория не указала количество, а для этого материала есть порог значимости — 10${sup(threshold.lg)} КОЕ/мл. Без счёта или степени роста ответить, значим ли рост, нельзя.`,
    threshold,
  };
}

function clinicalHit(
  rule: ClinicalRule,
  locusKey: string,
  context: ContextFlag[],
  organism?: Organism,
  significance?: Significance,
): boolean {
  if (rule.loci && !rule.loci.includes(locusKey)) return false;
  if (rule.requireContext && !rule.requireContext.every((flag) => context.includes(flag))) return false;
  if (rule.forbidContext && rule.forbidContext.some((flag) => context.includes(flag))) return false;
  if (rule.groups || rule.organisms) {
    if (!organism || !matchesOrganism(rule, organism)) return false;
  }
  if (rule.significance && (!significance || !rule.significance.includes(significance))) return false;
  return true;
}

export function interpretCulture(ref: MicrobiologyReference, report: CultureReport): CultureVerdict {
  const locus = ref.loci.find((l) => l.key === report.locusKey);
  const organismByKey = new Map(ref.organisms.map((o) => [o.key, o]));
  const antibioticByKey = new Map(ref.antibiotics.map((a) => [a.key, a]));
  // Порядок в справочнике — от узких препаратов к широким; им же упорядочены и подсказки, чтобы
  // первым в списке стоял не самый мощный, а самый узкий из работающих.
  const antibioticOrder = new Map(ref.antibiotics.map((a, i) => [a.key, i]));

  const isolates: IsolateVerdict[] = report.noGrowth
    ? []
    : report.isolates.map((isolate) => {
        const organism = isolate.organismKey ? organismByKey.get(isolate.organismKey) : undefined;
        const { significance, why, threshold } = significanceOf(locus, organism, isolate, report.context);

        const results = new Map(isolate.susceptibility.map((e) => [e.antibioticKey, e.result]));
        const phenotypes = organism
          ? ref.phenotypes.filter((rule) => phenotypeHit(rule, organism, results))
          : [];

        const conflicts: Conflict[] = [];
        const options: DrugVerdict[] = [];
        const suppressed: DrugVerdict[] = [];
        const resistant: DrugVerdict[] = [];

        for (const entry of isolate.susceptibility) {
          const antibiotic = antibioticByKey.get(entry.antibioticKey);
          const label = antibiotic?.name ?? entry.label ?? entry.antibioticKey;
          const verdict: DrugVerdict = { antibiotic, label, entry };

          if (entry.result === 'R') {
            resistant.push(verdict);
            continue;
          }

          // 1. Природная устойчивость: бланк утверждает невозможное.
          const intrinsic =
            organism && antibiotic
              ? ref.intrinsic.find((rule) => intrinsicHit(rule, organism, antibiotic))
              : undefined;
          if (intrinsic) {
            conflicts.push({ label, result: entry.result, why: intrinsic.why, ruleId: intrinsic.id });
            suppressed.push({ ...verdict, suppressedBy: { kind: 'intrinsic', why: intrinsic.why } });
            continue;
          }

          // 2. Фенотип отменяет строки, которые лаборатория обязана была подавить, но не подавила.
          const blocking = antibiotic
            ? phenotypes.find(
                (p) =>
                  p.invalidates &&
                  ((p.invalidates.classes?.includes(antibiotic.klass) ?? false) ||
                    (p.invalidates.antibiotics?.includes(antibiotic.key) ?? false)),
              )
            : undefined;
          if (blocking) {
            suppressed.push({
              ...verdict,
              suppressedBy: { kind: 'phenotype', why: `${blocking.title}: ${blocking.invalidates!.why}` },
            });
            continue;
          }

          // 3. Препарат не доходит до места: диск стоял в чашке, а не в почке.
          const unreachable = antibiotic && locus ? reachability(antibiotic, locus.key) : undefined;
          if (unreachable) {
            suppressed.push({ ...verdict, suppressedBy: { kind: 'locus', why: unreachable } });
            continue;
          }

          options.push({
            ...verdict,
            caution:
              entry.result === 'I'
                ? 'Категория I — «чувствителен при увеличенной экспозиции»: препарат годится, но в высокой дозе и там, где он концентрируется. Это не «промежуточный» в старом смысле.'
                : antibiotic?.note,
          });
        }

        options.sort((a, b) => {
          // Сначала бесспорно чувствительные, потом требующие увеличенной дозы.
          if (a.entry.result !== b.entry.result) return a.entry.result === 'S' ? -1 : 1;
          return (antibioticOrder.get(a.entry.antibioticKey) ?? 999) - (antibioticOrder.get(b.entry.antibioticKey) ?? 999);
        });

        const notes = ref.clinical.filter(
          (rule) =>
            rule.scope === 'isolate' && clinicalHit(rule, report.locusKey, report.context, organism, significance),
        );

        return {
          isolate,
          organism,
          label: organism ? `${organism.ru} (${organism.name})` : isolate.organismLabel || 'Возбудитель не указан',
          significance,
          why,
          threshold,
          phenotypes,
          conflicts,
          options,
          suppressed,
          resistant,
          notes,
        };
      });

  const anySignificant = isolates.some((i) => SIGNIFICANT.includes(i.significance));

  const notes = ref.clinical.filter((rule) => {
    if (rule.scope !== 'report') return false;
    if (!clinicalHit(rule, report.locusKey, report.context)) return false;
    const cond = rule.report;
    if (!cond) return true;
    if (cond.noGrowth !== undefined && cond.noGrowth !== report.noGrowth) return false;
    if (cond.minIsolates !== undefined && isolates.length < cond.minIsolates) return false;
    if (cond.anySignificant !== undefined && cond.anySignificant !== anySignificant) return false;
    return true;
  });

  return { locus, isolates, notes, anySignificant };
}

/** Доходит ли препарат до этого материала. Возвращает причину, если нет. */
function reachability(antibiotic: Antibiotic, locusKey: string): string | undefined {
  if (antibiotic.onlyFor && !antibiotic.onlyFor.loci.includes(locusKey)) {
    return `${antibiotic.name} применим только там, где ${antibiotic.onlyFor.why}; до этого материала он не доходит.`;
  }
  const blocked = antibiotic.notFor?.find((n) => n.locus === locusKey);
  return blocked ? `${antibiotic.name} здесь не работает: ${blocked.why}.` : undefined;
}

/** Подпись значимости — одна на весь раздел, чтобы карточка и список не расходились в словах. */
export const SIGNIFICANCE_LABEL: Record<Significance, string> = {
  pathogen: 'Возбудитель',
  significant: 'Рост значим',
  'below-threshold': 'Ниже порога',
  flora: 'Нормальная флора',
  contaminant: 'Вероятное загрязнение',
  unknown: 'Судить нечем',
};

export const SIGNIFICANCE_COLOR: Record<Significance, string> = {
  pathogen: 'red',
  significant: 'orange',
  'below-threshold': 'gray',
  flora: 'teal',
  contaminant: 'gray',
  unknown: 'gray',
};

export const SEVERITY_COLOR: Record<Severity, string> = { info: 'blue', warning: 'orange', critical: 'red' };
