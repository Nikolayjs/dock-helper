import { Badge, Table, Text } from '@mantine/core';
import dayjs from 'dayjs';

import type { DispensaryRecord, Patient } from './types';
import { diagnosisCodeOf, diagnosisLabel } from './useIcd10Names';

/**
 * Every patient on the register, one row each.
 *
 * The aggregate answers how many and the per-diagnosis table answers of what; this is the list the
 * two are built from — the one a doctor checks a name against, and the one an inspection asks for.
 *
 * Names can be switched off. A caseload breakdown is routinely shown to people with no business
 * knowing who is on it, and a report that has to be retyped to be shareable does not get shared.
 * Hiding drops the column outright rather than masking the text: initials and a birth year identify
 * a patient in a small practice just as well as a name does.
 */

interface DispensaryPatientTableProps {
  records: DispensaryRecord[];
  patientsById: Map<string, Patient>;
  icdNames: Record<string, string>;
  hideNames: boolean;
  /** Ages are stated as of this date, so a report keeps saying the same thing next year. */
  asOf: string;
}

function ageAt(birthDate: string | null, asOf: string): number | null {
  if (!birthDate) return null;
  const age = dayjs(asOf).diff(dayjs(birthDate), 'year');
  return age >= 0 ? age : null;
}

export function DispensaryPatientTable({
  records,
  patientsById,
  icdNames,
  hideNames,
  asOf,
}: DispensaryPatientTableProps) {
  if (records.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Под выбранные условия не подходит ни одна карта учёта.
      </Text>
    );
  }

  return (
    <Table.ScrollContainer minWidth={hideNames ? 640 : 820}>
      <Table withTableBorder withColumnBorders striped fz="sm">
        <Table.Thead>
          <Table.Tr>
            <Table.Th w={48}>№</Table.Th>
            {!hideNames && <Table.Th>ФИО</Table.Th>}
            <Table.Th w={60}>Пол</Table.Th>
            <Table.Th w={80}>Возраст</Table.Th>
            <Table.Th>Диагноз</Table.Th>
            <Table.Th w={90}>Код МКБ</Table.Th>
            <Table.Th w={120}>На учёте с</Table.Th>
            <Table.Th w={140}>Статус</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {records.map((record, index) => {
            const patient = patientsById.get(record.patientId);
            const age = patient ? ageAt(patient.birthDate, asOf) : null;
            return (
              <Table.Tr key={record.id}>
                <Table.Td c="dimmed">{index + 1}</Table.Td>
                {!hideNames && (
                  <Table.Td>{patient?.fullName ?? <Text c="dimmed">пациент удалён</Text>}</Table.Td>
                )}
                <Table.Td>{patient?.sex === 'male' ? 'М' : patient?.sex === 'female' ? 'Ж' : '—'}</Table.Td>
                <Table.Td>{age ?? '—'}</Table.Td>
                <Table.Td>{diagnosisLabel(record.diagnosis, record.diagnosisCode, icdNames)}</Table.Td>
                <Table.Td c={diagnosisCodeOf(record.diagnosis, record.diagnosisCode) ? undefined : 'dimmed'}>
                  {diagnosisCodeOf(record.diagnosis, record.diagnosisCode) ?? '—'}
                </Table.Td>
                <Table.Td>{dayjs(record.registeredDate).format('DD.MM.YYYY')}</Table.Td>
                <Table.Td>
                  {record.status === 'active' ? (
                    <Badge variant="light" color="teal" size="sm">
                      Состоит
                    </Badge>
                  ) : (
                    <Badge variant="light" color="gray" size="sm">
                      {record.removedReason === 'recovered' ? 'Снят: выздоровление' : 'Снят: выбыл'}
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
