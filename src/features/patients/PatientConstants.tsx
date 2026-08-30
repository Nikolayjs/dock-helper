import { useMemo } from 'react';
import { Anchor, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconCalculator, IconEdit } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';

import { PageSection } from '../../components/common/PageSection';
import { CREATININE, latestValueByName } from '../labResults/latestValue';
import { useLabResults } from '../labResults/useLabResults';
import type { Patient } from './types';
import { bodyMassIndex } from './utils';

function Value({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={500}>
        {children}
      </Text>
    </Stack>
  );
}

/**
 * Рост, вес, креатинин и учётные данные пациента.
 *
 * Это то, из чего считается всё, что считается «по пациенту»: доза, ИМТ, клиренс креатинина.
 * Раньше половины этих полей не было вовсе — импорт чужого реестра выбрасывал полис и адрес прямо
 * с пометкой «класть некуда».
 *
 * **Креатинин здесь не поле, а последнее значение из сохранённых бланков** (см. `latestValueByName`).
 * Второе место для него завело бы два источника, которые разойдутся; хуже того, поле в карточке не
 * стареет заметно — число, введённое год назад, точно так же ушло бы в расчёт клиренса.
 */
export function PatientConstants({ patient }: { patient: Patient }) {
  const navigate = useNavigate();
  const { results } = useLabResults();

  const creatinine = useMemo(
    () => latestValueByName(results.filter((result) => result.patientId === patient.id), CREATININE),
    [results, patient.id],
  );

  const bmi = bodyMassIndex(patient.heightCm, patient.weightKg);
  const hasAnything =
    patient.heightCm !== null ||
    patient.weightKg !== null ||
    Boolean(patient.insurancePolicy || patient.district || patient.address) ||
    creatinine !== undefined;

  return (
    <PageSection
      title="Константы"
      action={
        <Group gap="xs" wrap="wrap">
          {/* Калькулятор открывается **через список**: меню калькуляторов здесь было бы вторым их
              списком — с поиском, разделами и звёздочками, которые пришлось бы повторить. */}
          <Button
            size="xs"
            variant="light"
            leftSection={<IconCalculator size={14} />}
            onClick={() =>
              navigate(`/calculators?patientId=${patient.id}`, { state: { from: `/patients/${patient.id}` } })
            }
          >
            Посчитать
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconEdit size={14} />}
            onClick={() => navigate(`/patients/${patient.id}/edit`)}
          >
            Заполнить
          </Button>
        </Group>
      }
    >
      {!hasAnything ? (
        <Text size="sm" c="dimmed">
          Рост, вес и учётные данные не записаны. По ним считаются доза, ИМТ и клиренс креатинина —
          без них калькуляторы приходится заполнять руками на каждом приёме.
        </Text>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="md">
          {patient.heightCm !== null && <Value label="Рост">{patient.heightCm} см</Value>}
          {patient.weightKg !== null && <Value label="Вес">{patient.weightKg} кг</Value>}
          {/* ИМТ показан числом, без толкования: толкование — дело калькулятора, и второе,
              написанное здесь, разошлось бы с ним при первой же правке порогов. */}
          {bmi !== null && <Value label="ИМТ">{bmi}</Value>}
          {patient.measuredAt && (
            <Value label="Измерено">{dayjs(patient.measuredAt).format('D MMMM YYYY')}</Value>
          )}
          {creatinine && (
            <Value label="Креатинин">
              <Group gap={6} wrap="nowrap">
                <Text size="sm" fw={500} span>
                  {creatinine.value}
                  {creatinine.unit ? ` ${creatinine.unit}` : ''}
                </Text>
                {/* Дата — часть значения, а не украшение: креатинин годовой давности не про
                    сегодня, а ссылка ведёт в тот самый бланк, откуда он взят. */}
                <Anchor
                  component={Link}
                  to={`/patients/${patient.id}/analyses/${creatinine.resultId}`}
                  state={{ from: `/patients/${patient.id}` }}
                  size="xs"
                  c="dimmed"
                >
                  {dayjs(creatinine.takenAt).format('D MMM YYYY')}
                </Anchor>
              </Group>
            </Value>
          )}
          {patient.insurancePolicy && <Value label="Полис ОМС">{patient.insurancePolicy}</Value>}
          {patient.district && <Value label="Участок">{patient.district}</Value>}
          {patient.address && <Value label="Адрес">{patient.address}</Value>}
        </SimpleGrid>
      )}
    </PageSection>
  );
}
