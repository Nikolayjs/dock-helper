import type { DispensaryObservation, DispensaryOutcome, DispensaryRecord } from './types';

export interface DispensaryStats {
  consisted: number;
  taken: number;
  recoveredRemoved: number;
  leftRemoved: number;
  totalRemoved: number;
  consists: number;
  effectiveness: Record<DispensaryOutcome, number>;
  ovl: number;
  sanatorium: number;
  campRest: number;
}

export interface DiagnosisStats extends DispensaryStats {
  diagnosis: string;
  /** Taken from the first record of the group that names one; registers fill it inconsistently. */
  diagnosisCode?: string;
}

function inPeriod(date: string, periodStart: string, periodEnd: string): boolean {
  return date >= periodStart && date <= periodEnd;
}

function lastObservationInPeriod(observations: DispensaryObservation[], periodStart: string, periodEnd: string): DispensaryObservation | null {
  const inRange = observations.filter((obs) => inPeriod(obs.date, periodStart, periodEnd));
  if (inRange.length === 0) return null;
  return [...inRange].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
}

export function computeDispensaryStats(records: DispensaryRecord[], periodStart: string, periodEnd: string): DispensaryStats {
  const stats: DispensaryStats = {
    consisted: 0,
    taken: 0,
    recoveredRemoved: 0,
    leftRemoved: 0,
    totalRemoved: 0,
    consists: 0,
    effectiveness: { worsened: 0, improved: 0, recovered: 0, unchanged: 0, death: 0 },
    ovl: 0,
    sanatorium: 0,
    campRest: 0,
  };

  for (const record of records) {
    const wasRegisteredBeforePeriod = record.registeredDate < periodStart;
    const removedBeforePeriod = record.removedDate !== null && record.removedDate < periodStart;
    if (wasRegisteredBeforePeriod && !removedBeforePeriod) {
      stats.consisted += 1;
    }

    if (inPeriod(record.registeredDate, periodStart, periodEnd)) {
      stats.taken += 1;
    }

    if (record.removedDate !== null && inPeriod(record.removedDate, periodStart, periodEnd)) {
      stats.totalRemoved += 1;
      if (record.removedReason === 'recovered') stats.recoveredRemoved += 1;
      if (record.removedReason === 'left') stats.leftRemoved += 1;
    }

    const registeredByPeriodEnd = record.registeredDate <= periodEnd;
    const stillRegisteredAtPeriodEnd = record.removedDate === null || record.removedDate > periodEnd;
    if (registeredByPeriodEnd && stillRegisteredAtPeriodEnd) {
      stats.consists += 1;
    }

    const onRegistryDuringPeriod = registeredByPeriodEnd && (record.removedDate === null || record.removedDate >= periodStart);
    if (onRegistryDuringPeriod) {
      const lastObs = lastObservationInPeriod(record.observations, periodStart, periodEnd);
      if (lastObs) stats.effectiveness[lastObs.outcome] += 1;

      const obsInPeriod = record.observations.filter((obs) => inPeriod(obs.date, periodStart, periodEnd));
      if (obsInPeriod.some((obs) => obs.ovl)) stats.ovl += 1;
      if (obsInPeriod.some((obs) => obs.sanatorium)) stats.sanatorium += 1;
      if (obsInPeriod.some((obs) => obs.campRest)) stats.campRest += 1;
    }
  }

  return stats;
}

/**
 * The same report, split by disease.
 *
 * One aggregate row answers "how many"; a doctor planning next year's work needs "of what" — which
 * diseases the caseload actually consists of. Grouping runs the existing calculation over each
 * subset rather than reimplementing it, so a line can never disagree with the total beneath it.
 *
 * Diagnoses are grouped case-insensitively on trimmed text: the same disease is typed
 * `Артериальная гипертензия` on one card and `артериальная  гипертензия` on the next, and two rows
 * for one disease would misstate every line of the report.
 */
export function computeStatsByDiagnosis(
  records: DispensaryRecord[],
  periodStart: string,
  periodEnd: string,
): DiagnosisStats[] {
  const groups = new Map<string, DispensaryRecord[]>();
  for (const record of records) {
    const key = record.diagnosis.trim().replace(/\s+/g, ' ').toLowerCase();
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }

  return [...groups.values()]
    .map((group) => ({
      // The first spelling encountered is the label; they differ only in case and spacing.
      diagnosis: group[0].diagnosis.trim().replace(/\s+/g, ' '),
      diagnosisCode: group.find((r) => r.diagnosisCode)?.diagnosisCode,
      ...computeDispensaryStats(group, periodStart, periodEnd),
    }))
    // Heaviest caseload first: that is the order the question "what do I mostly treat" is asked in.
    .filter((row) => row.consists > 0 || row.consisted > 0 || row.taken > 0 || row.totalRemoved > 0)
    .sort((a, b) => b.consists - a.consists || b.taken - a.taken || a.diagnosis.localeCompare(b.diagnosis));
}
