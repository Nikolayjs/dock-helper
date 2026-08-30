import { useMemo } from 'react';
import { Alert, Badge, Button, Card, Container, Group, Stack, Table, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BackButton } from '../../components/common/BackButton';
import { AnalyzerResults } from '../analyzer/AnalyzerResults';
import { toLabTestDefinition } from '../analyzer/customTypes';
import { formatParamValue } from '../analyzer/formatValue';
import { getParamRange } from '../analyzer/types';
import type { LabParameter, ParamStatus, Sex } from '../analyzer/types';
import { useCustomAnalyzers } from '../analyzer/useCustomAnalyzers';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { usePatients } from '../patients/usePatients';
import { formatAge } from '../patients/utils';
import { interpretResult } from './interpret';
import { QUERY_KEY, useLabResults } from './useLabResults';

const STATUS_COLOR: Record<ParamStatus, string | undefined> = { low: 'blue', high: 'red', normal: undefined };
const SEX_LABEL: Record<Sex, string> = { male: 'мужской', female: 'женский' };

/** Норма показателя строкой. Пусто — значит нормы нет, и притворяться, что значение в ней, нельзя. */
function rangeText(param: LabParameter | undefined, sex: Sex, age: number | undefined): string {
  if (!param) return '';
  const range = getParamRange(param, sex, age);
  if (range.min === undefined && range.max === undefined) return '';
  const format = (value: number) => formatParamValue(value, param);
  if (range.min === undefined) return `до ${format(range.max!)}`;
  if (range.max === undefined) return `от ${format(range.min)}`;
  return `${format(range.min)}–${format(range.max)}`;
}

/**
 * Один сохранённый бланк: что измерено и что из этого следует.
 *
 * Заключения считаются заново по сегодняшнему анализатору — см. `interpretResult`, — поэтому
 * страница показывает не снимок, а актуальное толкование тех же чисел. Значения и их названия,
 * наоборот, берутся из самой записи: показатель могли переименовать или убрать, а бланк обязан
 * читаться таким, каким его завели.
 */
export function LabResultViewPage() {
  const { id, patientId } = useParams();
  const navigate = useNavigate();
  const { results, isLoading, deleteResult } = useLabResults();
  const { patients } = usePatients();
  const { customTests } = useCustomAnalyzers();
  const confirmDelete = useDeleteWithConfirm();

  const tests = useMemo(() => customTests.map(toLabTestDefinition), [customTests]);
  const result = results.find((item) => item.id === id);

  // Пока список не пришёл, страница пуста: «анализ не найден» до этого — враньё, и оно мигало бы на
  // каждом открытии по прямой ссылке и после перезагрузки.
  if (isLoading) return null;

  if (!result) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Анализ не найден</Text>
          <Button component={Link} to={patientId ? `/patients/${patientId}` : '/patients'} mt="md">
            К карточке пациента
          </Button>
        </Stack>
      </Container>
    );
  }

  const patient = patients.find((item) => item.id === result.patientId);
  const { test, analysis } = interpretResult(result, tests);
  const paramByKey = new Map((test?.parameters ?? []).map((param) => [param.key, param]));
  const patientPath = `/patients/${result.patientId}`;

  const handleDelete = () =>
    confirmDelete({
      what: 'анализ',
      name: `${dayjs(result.takenAt).format('D MMMM YYYY')} — ${result.analyzerTitle}`,
      notice: 'Анализ удалён',
      queryKey: QUERY_KEY,
      id: result.id,
      perform: () => deleteResult(result.id),
      onConfirmed: () => navigate(patientPath),
    });

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <BackButton fallback={{ to: patientPath, label: 'К карточке пациента' }} />
          <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
            Удалить
          </Button>
        </Group>

        <Card withBorder padding="lg">
          <Stack gap="xs">
            <Title order={3}>{result.analyzerTitle || 'Анализ'}</Title>
            <Group gap={8} wrap="wrap">
              <Badge variant="light" color="brand">
                {dayjs(result.takenAt).format('D MMMM YYYY')}
              </Badge>
              {patient ? (
                <Badge variant="light" color="gray" component={Link} to={patientPath} style={{ cursor: 'pointer' }}>
                  {patient.fullName}
                </Badge>
              ) : (
                <Badge variant="light" color="gray">
                  Пациент удалён
                </Badge>
              )}
              {/* По каким нормам читали — часть записи, а не оформление: у ребёнка и взрослого
                  расходятся и гемоглобин, и лейкоциты, и щелочная фосфатаза. */}
              <Text size="sm" c="dimmed">
                Нормы: пол {SEX_LABEL[result.sex]}
                {result.ageYears !== null ? `, ${formatAge(result.ageYears)}` : ', возраст не указан'}
              </Text>
            </Group>
            {result.note && <Text size="sm">{result.note}</Text>}
          </Stack>
        </Card>

        {!test && (
          <Alert variant="light" color="orange" icon={<IconAlertTriangle size={18} />}>
            Анализатор, которым разбирали этот бланк, удалён. Значения сохранены и читаются, но
            заключения по ним посчитать нечем — норм больше нет.
          </Alert>
        )}

        <Card withBorder padding="lg">
          <Text fw={600} mb="sm">
            Показатели
          </Text>
          <Table.ScrollContainer minWidth={420}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Показатель</Table.Th>
                  <Table.Th>Значение</Table.Th>
                  <Table.Th>Норма</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {result.values.map((entry) => {
                  const param = paramByKey.get(entry.key);
                  const status = analysis?.statuses[entry.key];
                  return (
                    <Table.Tr key={entry.key}>
                      <Table.Td>{entry.label}</Table.Td>
                      <Table.Td>
                        {/* Отклонение помечено и стрелкой, а не одним цветом: направление здесь
                            и есть смысл, а цвет его только повторяет. */}
                        <Text span fw={status && status !== 'normal' ? 600 : 400} c={status ? STATUS_COLOR[status] : undefined}>
                          {param ? formatParamValue(entry.value, param) : entry.value}
                          {entry.unit ? ` ${entry.unit}` : ''}
                          {status === 'low' ? ' ↓' : ''}
                          {status === 'high' ? ' ↑' : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {rangeText(param, result.sex, result.ageYears ?? undefined)}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>

        {analysis && <AnalyzerResults result={analysis} />}
      </Stack>
    </Container>
  );
}
