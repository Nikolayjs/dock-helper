import { memo, useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconListCheck,
  IconRefresh,
  IconSearch,
  IconStethoscope,
  IconX,
} from '@tabler/icons-react';

import { DifferentialList } from './DifferentialList';
import {
  computePosteriors,
  explainCandidate,
  getRankedCandidates,
  rankSymptomsByGain,
  type Answer,
  type Finding,
} from './diagnosticEngine';
import { plural, withPlural } from '../../lib/plural';
import { FREQUENCY_LABELS } from './types';
import type { Disease, Symptom } from './types';
import type { DiagnosticAnswers } from './useDiagnosticAnswers';

interface SymptomPickerProps {
  diseases: Disease[];
  symptoms: Symptom[];
  state: DiagnosticAnswers;
}

/** Сколько признаков предлагать уточнить: это подсказка, а не второй опрос. */
const HINT_COUNT = 3;

interface SymptomRowProps {
  symptom: Symptom;
  answer: Answer | undefined;
  onMark: (symptomId: string, answer: Answer | null) => void;
}

/**
 * Строка мемоизирована по ссылке на симптом и своему ответу.
 *
 * В панели полсотни признаков, то есть сотня кнопок, а отметка любого из них меняет `answers` — и
 * без этого каждая отметка перерисовывала бы весь список целиком. Ровно та же причина, по которой
 * мемоизированы строки редактора таблицы и поля конструктора анализатора; обработчик приходит
 * постоянным из `useDiagnosticAnswers`, иначе мемоизация не работала бы вовсе.
 */
const SymptomRow = memo(function SymptomRow({ symptom, answer, onMark }: SymptomRowProps) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" align="center">
      <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
        {symptom.label}
      </Text>
      <Button.Group style={{ flexShrink: 0 }}>
        <Button
          size="compact-sm"
          variant={answer === 'yes' ? 'filled' : 'default'}
          color="teal"
          // Повторное нажатие снимает отметку: иначе признак, отмеченный по ошибке, снять нечем —
          // третьей кнопки «не проверяли» в строке нет, а перезапуск разбора ради одной опечатки
          // стоил бы всех остальных отметок.
          onClick={() => onMark(symptom.id, answer === 'yes' ? null : 'yes')}
          aria-pressed={answer === 'yes'}
        >
          Есть
        </Button>
        <Button
          size="compact-sm"
          variant={answer === 'no' ? 'filled' : 'default'}
          color="red"
          onClick={() => onMark(symptom.id, answer === 'no' ? null : 'no')}
          aria-pressed={answer === 'no'}
        >
          Нет
        </Button>
      </Button.Group>
    </Group>
  );
});

function FindingRow({ finding }: { finding: Finding }) {
  const color = finding.direction === 'for' ? 'teal' : finding.direction === 'against' ? 'red' : 'gray';
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
      <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }} align="flex-start">
        <ThemeIcon size={18} radius="xl" variant="light" color={finding.answer === 'yes' ? 'teal' : 'gray'} mt={2}>
          {finding.answer === 'yes' ? <IconCheck size={12} /> : <IconX size={12} />}
        </ThemeIcon>
        <Text size="sm">{finding.symptom.label}</Text>
      </Group>
      <Badge size="sm" variant="light" color={color} style={{ flexShrink: 0 }}>
        {finding.frequency ? FREQUENCY_LABELS[finding.frequency] : 'нет в матрице'}
      </Badge>
    </Group>
  );
}

/**
 * Второй режим панели: врач отмечает то, что видит, а движок связывает отмеченное с заболеванием.
 *
 * Считает тот же самый байесовский движок, что и опрос, — и это несущее: два способа посчитать
 * один и тот же случай разошлись бы, и какой из них верен, было бы не видно. Разница только в том,
 * кто выбирает признаки: в опросе их выбирает движок по приросту информации, здесь — врач.
 *
 * **Неотмеченный признак не значит «нет».** Признаков в панели полсотни, а врач отмечает пять:
 * считать остальные сорок пять отсутствующими значило бы приписать ему сорок пять утверждений,
 * которых он не делал, — и разбор, построенный на них, выглядел бы таким же уверенным, как
 * настоящий. Поэтому состояний три, и «не проверяли» — состояние по умолчанию: в расчёт идёт
 * ровно то, что отмечено.
 */
export function SymptomPicker({ diseases, symptoms, state }: SymptomPickerProps) {
  const { answers, setAnswer, reset, answeredCount, touched } = state;
  const [search, setSearch] = useState('');
  const [focusedDiseaseId, setFocusedDiseaseId] = useState<string | null>(null);

  const posteriors = useMemo(() => computePosteriors(diseases, symptoms, answers), [diseases, symptoms, answers]);
  const ranked = useMemo(() => getRankedCandidates(diseases, posteriors), [diseases, posteriors]);

  const yesCount = useMemo(() => Object.values(answers).filter((a) => a === 'yes').length, [answers]);
  const noCount = answeredCount - yesCount;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return symptoms;
    return symptoms.filter((s) => s.label.toLowerCase().includes(query));
  }, [symptoms, search]);

  // Разбор показывается для выбранной версии, а по умолчанию — для ведущей. Врачу нужно и
  // «почему это», и «почему не то, о чём я подумал»: вторая половина вопроса без выбора недоступна.
  const focused = useMemo(
    () => ranked.find((c) => c.disease.id === focusedDiseaseId) ?? ranked[0] ?? null,
    [ranked, focusedDiseaseId],
  );

  const findings = useMemo(
    () => (focused ? explainCandidate(focused.disease, diseases, symptoms, answers) : []),
    [focused, diseases, symptoms, answers],
  );

  const hints = useMemo(() => {
    if (answeredCount === 0) return [];
    // Пропущенное в опросе («не знаю») сюда не возвращается: врач уже сказал, что ответить не
    // может, и подсказка, предлагающая уточнить ровно это, — совет, которому нельзя последовать.
    return rankSymptomsByGain(diseases, symptoms, posteriors, touched).slice(0, HINT_COUNT);
  }, [diseases, symptoms, posteriors, touched, answeredCount]);

  const handleMark = useCallback(
    (symptomId: string, answer: Answer | null) => setAnswer(symptomId, answer),
    [setAnswer],
  );

  if (diseases.length === 0 || symptoms.length === 0) {
    return (
      <Card withBorder padding="xl">
        <Stack align="center" gap="sm" py="lg">
          <ThemeIcon size={48} radius="xl" variant="light" color="gray">
            <IconListCheck size={24} />
          </ThemeIcon>
          <Text fw={600}>Добавьте симптомы и заболевания</Text>
          <Text size="sm" c="dimmed" ta="center">
            Отмечать нечего, пока в панели нет ни одного признака.
          </Text>
        </Stack>
      </Card>
    );
  }

  const forFindings = findings.filter((f) => f.direction === 'for');
  const againstFindings = findings.filter((f) => f.direction === 'against');
  const neutralCount = findings.length - forFindings.length - againstFindings.length;

  return (
    <Stack gap="lg">
      <Card withBorder padding={0}>
        <Box p="md">
          <Group justify="space-between" wrap="wrap" gap="sm">
            <Text size="sm" c="dimmed">
              {answeredCount === 0
                ? `${withPlural(symptoms.length, 'признак', 'признака', 'признаков')} в панели`
                : `Отмечено: есть — ${yesCount}, нет — ${noCount}`}
            </Text>
            <Group gap="sm" wrap="wrap">
              <TextInput
                placeholder="Найти признак…"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                w={260}
              />
              <Button
                variant="subtle"
                color="gray"
                leftSection={<IconRefresh size={16} />}
                onClick={reset}
                disabled={answeredCount === 0}
              >
                Очистить
              </Button>
            </Group>
          </Group>
        </Box>
        <Divider />
        <Box p="md">
          {filtered.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">
              Ничего не найдено. Попробуйте изменить запрос.
            </Text>
          ) : (
            <Stack gap="xs">
              {filtered.map((symptom) => (
                <SymptomRow key={symptom.id} symptom={symptom} answer={answers[symptom.id]} onMark={handleMark} />
              ))}
            </Stack>
          )}
        </Box>
      </Card>

      {/* Пока ничего не отмечено, ранжировать нечего: список версий, посчитанный из одних приоров,
          — это не разбор случая, а порядок, в котором болезни вообще встречаются. Показать его
          под заголовком «наиболее вероятно» значило бы выдать за находку то, что верно всегда. */}
      {answeredCount === 0 ? (
        <Card withBorder padding="xl">
          <Stack align="center" gap="sm" py="lg">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconListCheck size={24} />
            </ThemeIcon>
            <Text fw={600}>Отметьте признаки</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              Разбор появится, как только вы отметите хотя бы один признак. Неотмеченный признак
              считается непроверенным, а не отсутствующим, — отмечайте «нет» тоже, если проверили.
            </Text>
          </Stack>
        </Card>
      ) : (
        focused && (
          <Card withBorder padding="xl">
            <Stack gap="md">
              <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
                <Group gap={10} wrap="nowrap" align="flex-start">
                  <ThemeIcon size={40} radius="xl" variant="light" color="brand">
                    <IconStethoscope size={20} />
                  </ThemeIcon>
                  <div>
                    <Text size="xs" c="dimmed">
                      {focused.disease.id === ranked[0]?.disease.id
                        ? 'Больше всего подходит'
                        : 'Разбор выбранной версии'}
                    </Text>
                    <Title order={3}>{focused.disease.name}</Title>
                  </div>
                </Group>
                <Badge size="lg" variant="light" color="brand" style={{ flexShrink: 0 }}>
                  {Math.round(focused.probability * 100)}%
                </Badge>
              </Group>

              {focused.disease.description && (
                <Text size="sm" c="dimmed">
                  {focused.disease.description}
                </Text>
              )}

              <Divider />

              {forFindings.length > 0 && (
                <Stack gap="xs">
                  <Text size="sm" fw={600}>
                    Говорит за
                  </Text>
                  {forFindings.map((f) => (
                    <FindingRow key={f.symptom.id} finding={f} />
                  ))}
                </Stack>
              )}

              {againstFindings.length > 0 && (
                <Stack gap="xs">
                  <Text size="sm" fw={600}>
                    Говорит против
                  </Text>
                  {againstFindings.map((f) => (
                    <FindingRow key={f.symptom.id} finding={f} />
                  ))}
                </Stack>
              )}

              {forFindings.length === 0 && againstFindings.length === 0 && (
                <Text size="sm" c="dimmed">
                  Отмеченное не отличает эту версию от остальных: эти признаки встречаются при них
                  примерно так же часто.
                </Text>
              )}

              {/* Признак «за» — это тот, что при этой болезни встречается чаще, чем при остальных
                  версиях панели, а не просто частый. Сказать это надо один раз и прямо: иначе
                  «Часто» в строке «говорит против» читается как ошибка расчёта. */}
              <Text size="xs" c="dimmed">
                Сравнение идёт с остальными версиями панели: «за» — признак, который при этом
                заболевании встречается чаще, чем при других, «против» — реже. В значке — частота
                признака при самом заболевании.
                {/* Число здесь подставляется в обычную фразу, и глагол при нём склоняется: «1
                    отмеченных признаков ничего не различают» читается как сбой программы ровно
                    там, где текст объясняет расчёт. */}
                {neutralCount > 0 &&
                  ` Ещё ${withPlural(neutralCount, 'отмеченный признак', 'отмеченных признака', 'отмеченных признаков')} ` +
                    `${plural(neutralCount, 'встречается', 'встречаются', 'встречаются')} одинаково часто у всех версий и ` +
                    `${plural(neutralCount, 'ничего не различает', 'ничего не различают', 'ничего не различают')}.`}
              </Text>
            </Stack>
          </Card>
        )
      )}

      {hints.length > 0 && (
        <Card withBorder padding="lg">
          <Text fw={600} size="sm">
            Что ещё уточнить
          </Text>
          {/* Список берётся из того же расчёта прироста информации, которым опрос выбирает
              следующий вопрос: два разных ответа на вопрос «что спросить дальше» означали бы, что
              подсказка ведёт не туда, куда повёл бы опрос. */}
          <Text size="xs" c="dimmed" mt={4} mb="md">
            Эти признаки сильнее всего разделяют оставшиеся версии.
          </Text>
          <Stack gap="xs">
            {hints.map(({ symptom }) => (
              <SymptomRow key={symptom.id} symptom={symptom} answer={answers[symptom.id]} onMark={handleMark} />
            ))}
          </Stack>
        </Card>
      )}

      {answeredCount > 0 && (
        <DifferentialList
          ranked={ranked}
          onSelect={(candidate) => setFocusedDiseaseId(candidate.disease.id)}
          selectedId={focused?.disease.id}
        />
      )}

      <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
        Результат — вспомогательная подсказка на основе введённых вами данных о заболеваниях и
        симптомах, а не медицинское заключение. Решение всегда принимает врач.
      </Alert>
    </Stack>
  );
}
