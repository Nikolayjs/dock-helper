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
