import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Group, Progress, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { IconAlertTriangle, IconHelpCircle, IconRefresh, IconStethoscope } from '@tabler/icons-react';

import {
  checkConfidence,
  computePosteriors,
  getRankedCandidates,
  pickNextSymptom,
  type Answer,
} from './diagnosticEngine';
import type { Disease, Symptom } from './types';

interface DiagnosticSessionProps {
  diseases: Disease[];
  symptoms: Symptom[];
}

const RANK_COLORS = ['brand', 'grape', 'blue', 'mint', 'gray'];

export function DiagnosticSession({ diseases, symptoms }: DiagnosticSessionProps) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [finishedEarly, setFinishedEarly] = useState(false);

  const posteriors = useMemo(() => computePosteriors(diseases, symptoms, answers), [diseases, symptoms, answers]);
  const ranked = useMemo(() => getRankedCandidates(diseases, posteriors), [diseases, posteriors]);
  const confidence = useMemo(() => checkConfidence(ranked), [ranked]);

  const excluded = useMemo(() => new Set([...Object.keys(answers), ...skipped]), [answers, skipped]);
  const nextSymptom = useMemo(
    () => pickNextSymptom(diseases, symptoms, posteriors, excluded),
    [diseases, symptoms, posteriors, excluded],
  );

  const questionsAsked = Object.keys(answers).length + skipped.size;
  const isDone = finishedEarly || confidence.isConfident || !nextSymptom;

  const reset = () => {
    setAnswers({});
    setSkipped(new Set());
    setFinishedEarly(false);
  };

  const answer = (value: Answer) => {
    if (!nextSymptom) return;
    setAnswers((prev) => ({ ...prev, [nextSymptom.id]: value }));
  };

  const skip = () => {
    if (!nextSymptom) return;
    setSkipped((prev) => new Set(prev).add(nextSymptom.id));
  };

  if (diseases.length === 0 || symptoms.length === 0) {
    return (
      <Card withBorder padding="xl">
        <Stack align="center" gap="sm" py="lg">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconHelpCircle size={24} />
          </ThemeIcon>
          <Text fw={600}>Добавьте симптомы и заболевания</Text>
          <Text size="sm" c="dimmed" ta="center">
            Опрос начнётся, как только в анкете будет хотя бы один симптом и одно заболевание.
          </Text>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="lg">
      {!isDone && questionsAsked > 0 && (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            Вопрос {questionsAsked + 1}
          </Text>
          <Button size="xs" variant="subtle" color="gray" onClick={() => setFinishedEarly(true)}>
            Завершить и посмотреть результат
          </Button>
        </Group>
      )}

      {!isDone && nextSymptom && (
        <Card withBorder padding="xl">
          <Stack align="center" gap="lg" py="md">
            <ThemeIcon size={44} radius="xl" variant="light" color="brand">
              <IconHelpCircle size={22} />
            </ThemeIcon>
            <Title order={4} ta="center">
              {nextSymptom.label}
            </Title>
            <Group gap="sm">
              <Button color="teal" onClick={() => answer('yes')}>
                Да
              </Button>
              <Button color="red" variant="light" onClick={() => answer('no')}>
                Нет
              </Button>
              <Button variant="default" onClick={skip}>
                Не знаю
              </Button>
            </Group>
          </Stack>
        </Card>
      )}

      {isDone && (
        <Card withBorder padding="xl">
          <Stack gap="md">
            <Group justify="space-between" align="flex-start">
              <Group gap={10}>
                <ThemeIcon size={40} radius="xl" variant="light" color={confidence.isConfident ? 'teal' : 'orange'}>
                  <IconStethoscope size={20} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">
                    {confidence.isConfident ? 'Наиболее вероятный диагноз' : 'Точно определить не удалось — вот наиболее вероятные варианты'}
                  </Text>
                  <Title order={3}>{ranked[0]?.disease.name ?? '—'}</Title>
                </div>
              </Group>
              <Badge size="lg" variant="light" color={confidence.isConfident ? 'teal' : 'orange'}>
                {Math.round((ranked[0]?.probability ?? 0) * 100)}%
              </Badge>
            </Group>
            {ranked[0]?.disease.description && (
              <Text size="sm" c="dimmed">
                {ranked[0].disease.description}
              </Text>
            )}
            <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={reset} style={{ alignSelf: 'flex-start' }}>
              Начать заново
            </Button>
          </Stack>
        </Card>
      )}

      <Card withBorder padding="lg">
        <Text fw={600} size="sm" mb="md">
          Дифференциальный ряд
        </Text>
        <Stack gap="sm">
          {ranked.slice(0, 5).map((candidate, index) => (
            <div key={candidate.disease.id}>
              <Group justify="space-between" mb={4}>
                <Text size="sm">{candidate.disease.name}</Text>
                <Text size="sm" c="dimmed">
                  {Math.round(candidate.probability * 100)}%
                </Text>
              </Group>
              <Progress value={candidate.probability * 100} color={RANK_COLORS[index] ?? 'gray'} radius="xl" size="sm" />
            </div>
          ))}
        </Stack>
      </Card>

      <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
        Результат — вспомогательная подсказка на основе введённых вами данных о заболеваниях и симптомах, а не
        медицинское заключение. Решение всегда принимает врач.
      </Alert>
    </Stack>
  );
}
