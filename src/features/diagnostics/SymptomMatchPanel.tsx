import { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Badge,
  Box,
  Button,
  Card,
  Divider,
  Group,
  Loader,
  Pill,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconCheck,
  IconInfoCircle,
  IconPlus,
  IconSearch,
  IconStethoscope,
} from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { FREQUENCY_LABELS } from './types';
import { useSymptomMatch, useSymptomSuggestions, type DiseaseMatch } from './useSymptomMatch';
import { plural, withPlural } from '../../lib/plural';

/**
 * Подбор заболеваний по симптомам — по всем установленным панелям сразу.
 *
 * Это **вход в раздел**, а не режим одной панели: пациент говорит «насморк», потом «болит ухо», и
 * круг сужается по ходу разговора. Панель к этому моменту ещё не выбрана — жалобы, с которых
 * начинают, лежат в разных панелях («Насморк» и «Боль в ухе» — две разные), и внутри одной такой
 * разговор не разобрать вовсе.
 *
 * **Показывается счёт совпадения, а не вероятность, и процентов здесь нет намеренно.** Болезни
 * приходят из разных панелей, где вес до опроса подбирался каждый под свою жалобу; апостериорная
 * вероятность по ним — величина, посчитанная по несовместимым основаниям. Вопрос здесь другой и
 * честный: каким заболеваниям свойственны названные признаки. Внутри выбранной панели на вопрос
 * «насколько вероятна каждая версия» отвечает опрос — туда и ведёт ссылка на жалобу.
 */
export function SymptomMatchPanel() {
  const [terms, setTerms] = useState<string[]>([]);
  const [draft, setDraft] = useState('');

  /**
   * Отметка «выбор только что состоялся»: следующий `onChange` — это Mantine, а не врач.
   *
   * Подтвердив вариант, `Autocomplete` **сам записывает его в поле** — то есть затирает очистку уже
   * после того, как она произошла. Признак при этом добавлен, и, чтобы назвать следующий, врачу
   * приходится сначала стирать предыдущий вручную. Поэтому очистка переносится на тот самый
   * `onChange`, которым Mantine и пишет.
   */
  const justSubmitted = useRef(false);

  const { suggestions, isFetching: suggesting } = useSymptomSuggestions(draft);
  const { result, isFetching, error } = useSymptomMatch(terms);

  const addTerm = (value: string) => {
    const term = value.trim();
    if (!term) return;
    // Один и тот же признак дважды ничего не добавляет, а счёт удвоил бы: список возглавила бы
    // болезнь, которой этот признак свойственен, независимо от всего остального.
    setTerms((prev) => (prev.some((t) => t.toLowerCase() === term.toLowerCase()) ? prev : [...prev, term]));
    setDraft('');
  };

  const removeTerm = (term: string) => setTerms((prev) => prev.filter((t) => t !== term));

  /**
   * Вариант — это чистая формулировка признака, а счётчик рисуется отдельно.
   *
   * Счётчик стоял прямо в подписи варианта, и `Autocomplete` записывал в поле **её целиком**:
   * «Насморк, заложенность носа · 13 болезней». Служебное число не часть названия признака и уж
   * точно не то, что врач собирался набрать.
   */
  const countByLabel = useMemo(() => new Map(suggestions.map((s) => [s.label, s.diseaseCount])), [suggestions]);

  /**
   * Набранное — это **первая строка списка**, а не отдельный путь добавления.
   *
   * Так у добавления остаётся ровно одна дорога — `onOptionSubmit`, — и исчезает целый класс
   * ошибок: пока Enter перехватывался вручную, одно нажатие добавляло **два** признака (наш
   * обработчик клал черновик, а Mantine тем же нажатием подтверждал подсвеченный вариант).
   * Разводить их по состоянию выпадающего списка не вышло: собственный стор, переданный через
   * `comboboxProps`, расходится с внутренним, и список перестаёт открываться вовсе.
   *
   * Строка нужна ещё и по делу: короткое слово ищет шире готовой формулировки. «Насморк» найдёт
   * все восемь способов, которыми он записан в панелях, а «Насморк, заложенность носа» — только
   * свой.
   */
  const freeTerm = draft.trim();
  const options = useMemo(() => {
    const labels = suggestions.map((s) => s.label);
    if (!freeTerm) return labels;

    /*
     * Первой строкой стоит **ровно то, что набрано**, и когда такая формулировка в панелях уже
     * есть — она же и поднимается наверх, а не дублируется.
     *
     * Значения вариантов обязаны быть уникальными: на дубле Mantine бросает исключение и рисует
     * вместо поля белый прямоугольник — так уже ломался поиск в расширении. Но просто не добавлять
     * набранное оказалось хуже: подсветка падала на самую частую подсказку, и врач, набравший
     * «сыпь» и нажавший Enter, получал «Сыпь чешется» — не то, что он печатал. Поймано прогоном.
     */
    const exact = labels.find((l) => l.toLowerCase() === freeTerm.toLowerCase());
    return exact ? [exact, ...labels.filter((l) => l !== exact)] : [freeTerm, ...labels];
  }, [suggestions, freeTerm]);

  // Поля читаются защищённо: вкладка, открытая до деплоя, получает ответ прежней сборки, и
  // жёсткое обращение уронило бы ей весь раздел — ровно тот случай, ради которого написан
  // `staleChunkReload`. Здесь достаточно показать, что нашлось.
  const unmatched = result?.terms?.filter((t) => t.diseaseCount === 0) ?? [];

  return (
    <Stack gap="lg">
      <Card withBorder padding={0}>
        <Box p="md">
          <Stack gap="sm">
            <Autocomplete
              value={draft}
              onChange={(value) => {
                // Это Mantine дописывает подтверждённый вариант вслед за выбором — поле обязано
                // остаться пустым, чтобы следующий признак набирался сразу.
                if (justSubmitted.current) {
                  justSubmitted.current = false;
                  setDraft('');
                  return;
                }
                setDraft(value);
              }}
              onOptionSubmit={(value) => {
                justSubmitted.current = true;
                addTerm(value);
              }}
              data={options}
              // Сервер уже отобрал по началу слова; повторный отбор Mantine по строке варианта
              // выбросил бы «Накануне были насморк и кашель» у того, кто набрал «насморк», —
              // искали одно, а сверяли бы с другим.
              filter={({ options: shown }) => shown}
              // Первый вариант подсвечен сразу, поэтому Enter добавляет набранное, не требуя
              // сначала спуститься по списку стрелкой.
              selectFirstOptionOnChange
              renderOption={({ option }) => (
                <Group justify="space-between" wrap="nowrap" gap="sm" style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm">{option.value}</Text>
                  <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                    {option.value === freeTerm && !countByLabel.has(option.value)
                      ? 'искать по слову'
                      : withPlural(countByLabel.get(option.value) ?? 0, 'болезнь', 'болезни', 'болезней')}
                  </Text>
                </Group>
              )}
              placeholder="Назовите симптом — «насморк», «боль в ухе»…"
              leftSection={suggesting ? <Loader size={14} /> : <IconSearch size={16} />}
              rightSection={
                freeTerm ? (
                  <Button size="compact-xs" variant="subtle" onClick={() => addTerm(freeTerm)}>
                    <IconPlus size={14} />
                  </Button>
                ) : null
              }
              size="md"
            />

            {terms.length > 0 && (
              <Group gap="xs">
                {terms.map((term) => {
                  const summary = result?.terms?.find((t) => t.term === term);
                  return (
                    <Pill
                      key={term}
                      withRemoveButton
                      onRemove={() => removeTerm(term)}
                      size="md"
                      // Признак, которого нет ни в одной панели, отмечен: иначе врач считает, что
                      // он учтён, а в расчёте его не было вовсе.
                      bg={summary?.diseaseCount === 0 ? 'var(--mantine-color-red-light)' : undefined}
                    >
                      {term}
                    </Pill>
                  );
                })}
                <Button size="compact-sm" variant="subtle" color="gray" onClick={() => setTerms([])}>
                  Очистить
                </Button>
              </Group>
            )}
          </Stack>
        </Box>
      </Card>

      {unmatched.length > 0 && (
        <Alert color="orange" variant="light" icon={<IconInfoCircle size={16} />}>
          {plural(unmatched.length, 'Признак', 'Признаки', 'Признаки')}{' '}
          {unmatched.map((t) => `«${t.term}»`).join(', ')}{' '}
          {plural(unmatched.length, 'не найден', 'не найдены', 'не найдены')} ни в одной установленной
          панели и в подборе не участвуют. Попробуйте другое слово — например, короче.
        </Alert>
      )}

      {error && (
        <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>
          Не удалось подобрать заболевания. Попробуйте ещё раз.
        </Alert>
      )}

      {terms.length === 0 ? (
        <Card withBorder padding="xl">
          <Stack align="center" gap="sm" py="lg">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconStethoscope size={24} />
            </ThemeIcon>
            <Text fw={600}>Назовите первый симптом</Text>
            <Text size="sm" c="dimmed" ta="center" maw={460}>
              Пациент говорит «насморк» — появятся заболевания, которым он свойственен. Добавьте
              «боль в ухе» — круг сузится. Ищем по всем установленным панелям сразу.
            </Text>
          </Stack>
        </Card>
      ) : (
        <MatchResults result={result} isFetching={isFetching} termCount={terms.length} />
      )}

      <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>
        Подсказка по установленным панелям, а не медицинское заключение: список показывает, каким
        заболеваниям названные признаки свойственны. Решение всегда принимает врач.
      </Alert>
    </Stack>
  );
}

function MatchResults({
  result,
  isFetching,
  termCount,
}: {
  result: ReturnType<typeof useSymptomMatch>['result'];
  isFetching: boolean;
  termCount: number;
}) {
  if (!result) {
    return (
      <Card withBorder padding="xl">
        <Group justify="center" py="lg">
          <Loader size="sm" />
        </Group>
      </Card>
    );
  }

  if ((result.matches?.length ?? 0) === 0) {
    return (
      <Card withBorder padding="xl">
        <Stack align="center" gap="sm" py="lg">
          <Text fw={600}>Ничего не подошло</Text>
          <Text size="sm" c="dimmed" ta="center" maw={460}>
            Ни одному заболеванию из {withPlural(result.panelCount, 'установленной панели', 'установленных панелей', 'установленных панелей')}{' '}
            не свойственны все названные признаки. Уберите один из них или назовите его иначе.
          </Text>
          <Button component={Link} to="/store?tab=questionnaire" variant="light" mt="xs">
            Ещё панели в магазине
          </Button>
        </Stack>
      </Card>
    );
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="xs">
        {/* Показанное и найденное — разные числа: список обрезан потолком, и назвать двадцать
            показанных «двадцатью заболеваниями» значило бы выдать страницу за весь ответ. */}
        <Text size="sm" c="dimmed">
          {withPlural(result.total ?? result.matches?.length ?? 0, 'заболевание', 'заболевания', 'заболеваний')} по{' '}
          {withPlural(termCount, 'признаку', 'признакам', 'признакам')} · искали в{' '}
          {withPlural(result.panelCount, 'панели', 'панелях', 'панелях')}
          {(result.total ?? 0) > (result.matches?.length ?? 0) &&
            ` · показаны ${plural(result.matches?.length ?? 0, 'первое', 'первые', 'первые')} ${result.matches?.length}`}
        </Text>
        {isFetching && <Loader size="xs" />}
      </Group>

      {(result.matches ?? []).map((match) => (
        <MatchCard key={match.diseaseId} match={match} termCount={termCount} />
      ))}
    </Stack>
  );
}

function MatchCard({ match, termCount }: { match: DiseaseMatch; termCount: number }) {
  const explains = match.terms?.filter((t) => t.strength > 0) ?? [];
  const missing = match.terms?.filter((t) => t.strength === 0) ?? [];

  return (
    <Card withBorder padding="lg">
      <Stack gap="sm">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <Title order={4}>{match.name}</Title>
          <Badge
            size="lg"
            variant="light"
            color={match.covered === termCount ? 'teal' : 'gray'}
            style={{ flexShrink: 0 }}
          >
            {match.covered} из {termCount}
          </Badge>
        </Group>

        {match.description && (
          <Text size="sm" c="dimmed">
            {match.description}
          </Text>
        )}

        <Divider />

        <Stack gap={6}>
          {explains.map((term) => (
            <Group key={term.term} justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
              <Group gap={6} wrap="nowrap" style={{ flex: 1, minWidth: 0 }} align="flex-start">
                <ThemeIcon size={18} radius="xl" variant="light" color="teal" mt={2}>
                  <IconCheck size={12} />
                </ThemeIcon>
                <Text size="sm">
                  {term.label}
                  {/* Формулировка в панели почти никогда не совпадает с тем, что набрал врач:
                      «насморк» найдётся как «Накануне были насморк и кашель». Не показать, по чему
                      именно совпало, значит оставить совпадение непроверяемым. */}
                  {term.label && term.label.toLowerCase() !== term.term.toLowerCase() && (
                    <Text span size="xs" c="dimmed">
                      {' '}
                      — по запросу «{term.term}»
                    </Text>
                  )}
                </Text>
              </Group>
              {term.frequency && (
                <Badge size="sm" variant="light" color="teal" style={{ flexShrink: 0 }}>
                  {FREQUENCY_LABELS[term.frequency]}
                </Badge>
              )}
            </Group>
          ))}

          {missing.map((term) => (
            <Group key={term.term} justify="space-between" wrap="nowrap" gap="sm">
              <Text size="sm" c="dimmed" style={{ flex: 1, minWidth: 0 }}>
                {term.term}
              </Text>
              {/* «Не описан» — это не «нет»: панель просто не разбирает этот признак у этой
                  болезни. Написать «отсутствует» значило бы приписать источнику утверждение,
                  которого он не делал. */}
              <Badge size="sm" variant="default" style={{ flexShrink: 0 }}>
                не описан
              </Badge>
            </Group>
          ))}
        </Stack>

        <Group gap="xs" mt={4}>
          <Text size="xs" c="dimmed">
            Разбирают с жалобы:
          </Text>
          {(match.panels ?? []).map((panel) => (
            // Ссылка ведёт в опрос этой панели: подбор отвечает «что это может быть», а
            // «насколько вероятна каждая версия» считают уже внутри жалобы.
            <Badge
              key={panel.id}
              size="sm"
              variant="light"
              component={Link}
              to={`/diagnostics/${panel.id}`}
              style={{ cursor: 'pointer' }}
            >
              {panel.title}
            </Badge>
          ))}
        </Group>
      </Stack>
    </Card>
  );
}
