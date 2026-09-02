import { lastVisitOf } from './utils';
import type { DispensaryRecord, Patient } from './types';

/**
 * Диагноз, с которого начинается новый приём.
 *
 * Это не догадка: человек пришёл по диспансерной явке именно с этим диагнозом, а если карты учёта
 * нет — с тем же, с чем был в прошлый раз. Поле остаётся обычным, врач правит его, когда пришли с
 * другим; а перепечатывать одно и то же на каждом приёме не приходится.
 *
 * Жило это только в «Моём дне», хотя визит чаще заводят из карточки пациента — там форма
 * открывалась пустой.
 */
export function suggestedDiagnosis(
  patient: Patient,
  records: DispensaryRecord[],
): { diagnosis: string; diagnosisCode?: string } {
  const record = records.find((item) => item.patientId === patient.id && item.status === 'active');
  if (record) return { diagnosis: record.diagnosis, diagnosisCode: record.diagnosisCode };
  const last = lastVisitOf(patient);
  return { diagnosis: last?.diagnosis ?? '', diagnosisCode: last?.diagnosisCode };
}
