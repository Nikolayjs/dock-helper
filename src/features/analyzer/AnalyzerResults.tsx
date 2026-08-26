import { Alert, Badge, Card, Group, List, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconFlask2,
  IconInfoCircle,
  IconStethoscope,
} from '@tabler/icons-react';

import type { AnalysisResult } from './analyzerEngine';
import type { Severity } from './types';
import { formatParamValueWithUnit } from './formatValue';

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: 'red',
  warning: 'orange',
  info: 'cyan',
};

const SEVERITY_ICON: Record<Severity, typeof IconAlertTriangle> = {
  critical: IconAlertTriangle,
  warning: IconAlertTriangle,
  info: IconInfoCircle,
};

interface AnalyzerResultsProps {
  result: AnalysisResult;
}

export function AnalyzerResults({ result }: AnalyzerResultsProps) {
  if (result.enteredCount === 0) {
    return (
      <Card withBorder padding="xl">
        <Stack align="center" gap="sm" py="xl">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconFlask2 size={24} />
          </ThemeIcon>
          <Text fw={600}>Введите показатели анализа</Text>
          <Text size="sm" c="dimmed" ta="center" maw={360}>
            Можно заполнить не все поля — интерпретация строится по введённым значениям.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      {result.matchedPatterns.length > 0 && (
        <Stack gap="sm">
          <Title order={5}>Возможные состояния</Title>
          {result.matchedPatterns.map((pattern) => {
            const Icon = SEVERITY_ICON[pattern.severity];
            const color = SEVERITY_COLOR[pattern.severity];
            return (
              <Card
                key={pattern.id}
                withBorder
                padding="md"
                style={{ borderLeft: `3px solid var(--mantine-color-${color}-6)` }}
              >
                <Group gap={10} align="flex-start" wrap="nowrap">
                  <ThemeIcon size={30} radius="md" variant="light" color={color}>
                    <Icon size={16} />
                  </ThemeIcon>
                  <div style={{ flex: 1 }}>
                    <Text fw={600} size="sm">
                      {pattern.title}
                    </Text>
                    <List size="sm" c="dimmed" mt={4} spacing={2}>
                      {pattern.causes.map((cause) => (
                        <List.Item key={cause}>{cause}</List.Item>
                      ))}
                    </List>
                  </div>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}

      <Stack gap="sm">
        <Title order={5}>Отклонения по отдельным показателям</Title>
        {result.deviations.length === 0 ? (
          <Alert color="teal" variant="light" icon={<IconCircleCheck size={18} />}>
            Все введённые показатели в пределах референсных значений.
          </Alert>
        ) : (
          result.deviations.map((deviation) => {
            const causes = deviation.status === 'high' ? deviation.param.highCauses : deviation.param.lowCauses;
            const label = deviation.status === 'high' ? deviation.param.highLabel ?? 'Повышен' : deviation.param.lowLabel ?? 'Понижен';
            const color = deviation.status === 'high' ? 'red' : 'blue';
            const displayValue =
              deviation.param.inputType === 'select'
                ? deviation.param.options?.find((o) => o.value === deviation.value)?.label
                : formatParamValueWithUnit(deviation.value, deviation.param);

            return (
              <Card key={deviation.param.key} withBorder padding="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <div>
                    <Text fw={600} size="sm">
                      {deviation.param.label}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Значение: {displayValue}
                      {deviation.param.inputType === 'number' &&
                        (deviation.range.min !== undefined || deviation.range.max !== undefined) &&
                        ` · Норма: ${deviation.range.min ?? '—'}–${deviation.range.max ?? '—'}${deviation.param.unit ? ` ${deviation.param.unit}` : ''}`}
                    </Text>
                  </div>
                  <Badge color={color} variant="light" radius="sm">
                    {label}
                  </Badge>
                </Group>
                {causes && causes.length > 0 && (
                  <List size="sm" c="dimmed" mt={8} spacing={2}>
                    {causes.map((cause) => (
                      <List.Item key={cause}>{cause}</List.Item>
                    ))}
                  </List>
                )}
              </Card>
            );
          })
        )}
      </Stack>

      <Group gap={8} wrap="nowrap" opacity={0.7}>
        <IconStethoscope size={14} style={{ flexShrink: 0, marginTop: 2 }} />
        <Text size="xs" c="dimmed">
          Интерпретация носит вспомогательный характер, основана на стандартных референсных значениях (с учётом
          возраста и пола, где это предусмотрено) и не заменяет клиническую оценку врача. Референсные интервалы
          конкретной лаборатории могут отличаться.
        </Text>
      </Group>
    </Stack>
  );
}
