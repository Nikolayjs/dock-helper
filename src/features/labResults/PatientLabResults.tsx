import { useMemo } from 'react';
import { ActionIcon, Badge, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core';
import { IconFlask2, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { PageSection } from '../../components/common/PageSection';
import { toLabTestDefinition } from '../analyzer/customTypes';
import { useCustomAnalyzers } from '../analyzer/useCustomAnalyzers';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { LabDynamics } from './LabDynamics';
import { interpretResult } from './interpret';
import type { LabResult } from './types';
import { QUERY_KEY, useLabResults } from './useLabResults';

/** Что показывает бейдж на строке бланка: сколько отклонений и насколько они серьёзны. */
function summarise(result: LabResult, tests: ReturnType<typeof toLabTestDefinition>[]) {
  const { analysis } = interpretResult(result, tests);
  if (!analysis) return { color: 'gray', label: 'Анализатор удалён' };
  if (analysis.deviations.length === 0) return { color: 'teal', label: 'Все показатели в норме' };
  const critical = analysis.matchedPatterns.some((pattern) => pattern.severity === 'critical');
  return { color: critical ? 'red' : 'orange', label: `Отклонений: ${analysis.deviations.length}` };
}

/**
 * Сохранённые анализы прямо в карточке пациента.
 *
 * До этого разобранный анализ жил в состоянии страницы анализатора и исчезал при первом же
 * переходе. Здесь он становится частью карты: список бланков и динамика по показателю — то, ради
 * чего анализы и сдают повторно.
 */
export function PatientLabResults({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const { results, deleteResult } = useLabResults();
  const { customTests } = useCustomAnalyzers();
  const confirmDelete = useDeleteWithConfirm();

  const tests = useMemo(() => customTests.map(toLabTestDefinition), [customTests]);
  /**
   * Свежие бланки — сверху, и порядок задаётся здесь, а не берётся от сервера.
   *
   * Бэкенд и так отдаёт список по дате анализа, но полагаться на это нельзя: демо-режим — второй
   * «сервер» этого приложения, и он отдаёт записи в порядке добавления. Нашлось прогоном: в демо
   * анализы Егоровой шли от старого к новому, то есть ровно наоборот. Порядок списка — свойство
   * самого списка, а не ответа.
   */
  const own = useMemo(
    () =>
      results
        .filter((result) => result.patientId === patientId)
        .sort((a, b) => b.takenAt.localeCompare(a.takenAt) || b.createdAt.localeCompare(a.createdAt)),
    [results, patientId],
  );
  const patientPath = `/patients/${patientId}`;

  return (
    <PageSection
      title="Анализы"
      action={
        // Пол и возраст уезжают в анализатор адресом: без них возрастные нормы не работают, а
        // набирать их руками на каждый анализ — та самая помеха, из-за которой не набирают.
        <Button
          size="xs"
          variant="light"
          leftSection={<IconFlask2 size={14} />}
          onClick={() => navigate(`/analyzer?patientId=${patientId}`, { state: { from: patientPath } })}
        >
          Интерпретировать анализы
        </Button>
      }
    >
      {own.length === 0 ? (
        <Text size="sm" c="dimmed">
          Сохранённых анализов пока нет. Разберите бланк в анализаторе и сохраните его в карту — тогда
          по показателю будет видна динамика.
        </Text>
      ) : (
        <Stack gap="sm">
          {own.map((result) => {
            const summary = summarise(result, tests);
            return (
              <Card
                key={result.id}
                withBorder
                padding="md"
                radius="md"
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`${patientPath}/analyses/${result.id}`, { state: { from: patientPath } })}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={4} style={{ minWidth: 0 }}>
                    <Group gap={8} wrap="wrap">
                      <Text fw={600} size="sm">
                        {dayjs(result.takenAt).format('D MMMM YYYY')}
                      </Text>
                      <Badge variant="light" color="brand" size="sm">
                        {result.analyzerTitle || 'Без названия'}
                      </Badge>
                      <Badge variant="light" color={summary.color} size="sm">
                        {summary.label}
                      </Badge>
                    </Group>
                    {result.note && (
                      <Text size="sm" c="dimmed">
                        {result.note}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed">
                      Показателей: {result.values.length}
                    </Text>
                  </Stack>
                  <Tooltip label="Удалить анализ">
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        confirmDelete({
                          what: 'анализ',
                          name: `${dayjs(result.takenAt).format('D MMMM YYYY')} — ${result.analyzerTitle}`,
                          notice: 'Анализ удалён',
                          queryKey: QUERY_KEY,
                          id: result.id,
                          perform: () => deleteResult(result.id),
                        });
                      }}
                    >
                      <IconTrash size={14} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Card>
            );
          })}

          {/* Появляется сама, когда есть показатель хотя бы из двух бланков: до этого показывать
              нечего, а пустое место под заголовком читается как поломка. */}
          <LabDynamics results={own} tests={tests} />
        </Stack>
      )}
    </PageSection>
  );
}
