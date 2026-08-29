import { useMemo } from 'react';
import { Badge, Table, Text } from '@mantine/core';
import dayjs from 'dayjs';

import { useIncrementalList } from '../../lib/useIncrementalList';
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
  // Возраст, код и название диагноза считаются один раз на набор, а не в теле `.map`: реестр
  // участка — это тысячи карт, и на каждый рендер страницы они пересчитывались целиком.
  const rows = useMemo(
    () =>
      records.map((record, index) => {
        const patient = patientsById.get(record.patientId);
        return {
          record,
          patient,
          // Номер строки берётся отсюда, а не из индекса нарисованной порции: он про место записи
          // в реестре, а не про то, докуда врач успел прокрутить.
          number: index + 1,
          age: patient ? ageAt(patient.birthDate, asOf) : null,
          code: diagnosisCodeOf(record.diagnosis, record.diagnosisCode),
          label: diagnosisLabel(record.diagnosis, record.diagnosisCode, icdNames),
        };
      }),
    [records, patientsById, icdNames, asOf],
  );
  // Порционно только рисуется; счёт, отбор и нумерация идут по всему набору. Перед печатью хук
  // сам показывает весь реестр: обрезанный по месту прокрутки документ на бумаге неотличим от
  // целого.
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(rows);

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
          {visible.map(({ record, patient, number, age, code, label }) => {
            return (
              <Table.Tr key={record.id}>
                <Table.Td c="dimmed">{number}</Table.Td>
                {!hideNames && (
                  <Table.Td>{patient?.fullName ?? <Text c="dimmed">пациент удалён</Text>}</Table.Td>
                )}
                <Table.Td>{patient?.sex === 'male' ? 'М' : patient?.sex === 'female' ? 'Ж' : '—'}</Table.Td>
                <Table.Td>{age ?? '—'}</Table.Td>
                <Table.Td>{label}</Table.Td>
                <Table.Td c={code ? undefined : 'dimmed'}>{code ?? '—'}</Table.Td>
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
          {hasMore && (
            <Table.Tr ref={setSentinel}>
              <Table.Td colSpan={hideNames ? 7 : 8} ta="center" c="dimmed" fz="xs" py="md">
                Загружается ещё… осталось {remaining}
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
