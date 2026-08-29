import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Skeleton,
  Stack,
  Text,
  TagsInput,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconArrowRight, IconInfoCircle, IconLink, IconPills, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useDrugs } from '../drugs/useDrugs';
import { useIncrementalList } from '../../lib/useIncrementalList';
import { buildDrugIndex, checkInteractions, findSharedComponents, getKnownDrugNames, resolveEnteredDrugs } from './interactionEngine';
import type { ResolvedDrug, SharedComponent } from './interactionEngine';
import { SEVERITY_COLOR, SEVERITY_LABELS } from './types';
import { InteractionForm } from './InteractionForm';
import { QUERY_KEY as INTERACTIONS_KEY, useDrugInteractions } from './useDrugInteractions';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';

export function InteractionsCheck() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { interactions, isLoading, addInteraction, deleteInteraction } = useDrugInteractions();
  const confirmDelete = useDeleteWithConfirm();
  const { drugs, isLoading: drugsLoading } = useDrugs();
  const [entered, setEntered] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [ruleSearch, setRuleSearch] = useState('');
  const [drugSearch, setDrugSearch] = useState('');
  // Рамка со списком правил: она же граница видимости для дозагрузки по прокрутке.
  const [ruleBox, setRuleBox] = useState<HTMLDivElement | null>(null);

  /**
   * Восемьсот с лишним правил в одном списке нельзя ни пролистать, ни отрисовать целиком: поиск
   * идёт по обоим препаратам и механизму, а рисуется список порциями по мере прокрутки.
   */
  const matchedRules = useMemo(() => {
    const query = ruleSearch.trim().toLowerCase();
    if (!query) return interactions;
    return interactions.filter((rule) =>
      `${rule.drugA} ${rule.drugB} ${rule.mechanism}`.toLowerCase().includes(query),
    );
  }, [interactions, ruleSearch]);

  const rules = useIncrementalList(matchedRules, 40, { root: ruleBox });

  // A drug card links here with its МНН prefilled, so the doctor lands on the check already holding
  // the drug they were reading about and only has to add what else the patient takes.
  const preset = searchParams.get('drugs');
  useEffect(() => {
    if (!preset) return;
    const names = preset.split(',').map((name) => name.trim()).filter(Boolean);
    setEntered((prev) => [...prev, ...names.filter((name) => !prev.includes(name))]);
  }, [preset]);

  const index = useMemo(() => buildDrugIndex(drugs), [drugs]);
  const knownDrugNames = useMemo(() => getKnownDrugNames(drugs, interactions), [drugs, interactions]);
  const resolved = useMemo(() => resolveEnteredDrugs(entered, index), [entered, index]);
  const matches = useMemo(() => checkInteractions(entered, interactions, index), [entered, interactions, index]);
  const shared = useMemo(() => findSharedComponents(entered, index), [entered, index]);

  const innOptions = useMemo(() => drugs.map((drug) => drug.inn).sort((a, b) => a.localeCompare(b, 'ru')), [drugs]);

  // Пока не набрано ни буквы, подсказывать нечего: полторы тысячи названий по алфавиту начинаются
  // с «Абаджио» и «Авамиса», к которым врач не имеет никакого отношения. Пустой список Mantine не
  // показывает вовсе (`hiddenWhenEmpty` у выпадающего списка) — а как только буква набрана,
  // подсказка работает как обычно. Гасить её через `openOnFocus={false}` нельзя: набор текста
  // список **не** открывает, и подсказки не было бы вообще никогда.
  const drugSuggestions = useMemo(
    () => (drugSearch.trim() ? knownDrugNames : []),
    [drugSearch, knownDrugNames],
  );

  const handleDelete = (id: string) => {
    const interaction = interactions.find((item) => item.id === id);
    confirmDelete({
      what: 'взаимодействие',
      name: interaction ? `${interaction.drugA} + ${interaction.drugB}` : undefined,
      notice: 'Взаимодействие удалено',
      queryKey: INTERACTIONS_KEY,
      id,
      perform: () => deleteInteraction(id),
    });
  };

  return (
    <>
      <Stack gap="lg">
        <Alert variant="light" color="yellow" icon={<IconInfoCircle size={18} />} title="Не заменяет клиническое суждение">
          Проверка охватывает ограниченный набор хорошо известных взаимодействий, а не полную фармакологическую базу.
          Отсутствие предупреждения не гарантирует безопасность комбинации — при сомнениях сверяйтесь со справочником
          или инструкцией к препарату.
        </Alert>

        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md" wrap="wrap">
            <Group gap={8}>
              <ThemeIcon variant="light" color="brand" size={30} radius="md">
                <IconPills size={16} />
              </ThemeIcon>
              <Title order={4}>Препараты пациента</Title>
            </Group>

          </Group>

          {isLoading || drugsLoading ? (
            <Skeleton h={36} radius="md" />
          ) : (
            <>
              <TagsInput
                placeholder="Название с упаковки или МНН — «Нурофен» тоже подойдёт…"
                data={drugSuggestions}
                limit={20}
                searchValue={drugSearch}
                onSearchChange={setDrugSearch}
                value={entered}
                onChange={setEntered}
                clearable
              />
              <ResolutionLine resolved={resolved} />
            </>
          )}
        </Card>

        {/* Пустого состояния «добавьте минимум два препарата» здесь нет: под полем ввода и так
            лежит весь список правил, и плита во весь экран только отодвигала его вниз. Что
            проверяется попарно и что торговые названия распознаются, написано в самом поле и в
            предупреждении сверху. */}
        {entered.length >= 2 && (
          <Stack gap="sm">
            <SharedComponents shared={shared} />

            {matches.length === 0 && (
              <Alert variant="light" color="teal" icon={<IconInfoCircle size={18} />} title="Парных взаимодействий не найдено">
                Среди введённых препаратов нет пар из текущего списка проверки. Это не означает полную
                безопасность комбинации — см. предупреждение вверху страницы.
              </Alert>
            )}

            {matches.map(({ interaction, a, b, viaA, viaB }) => (
              <Alert
                key={interaction.id}
                variant="light"
                color={SEVERITY_COLOR[interaction.severity]}
                icon={<IconAlertTriangle size={18} />}
                title={
                  <Group gap={8} wrap="wrap">
                    <Text fw={600} span>
                      {pairTitle(a, b, viaA, viaB)}
                    </Text>
                    <Badge size="sm" color={SEVERITY_COLOR[interaction.severity]} variant="filled">
                      {SEVERITY_LABELS[interaction.severity]}
                    </Badge>
                  </Group>
                }
              >
                <Stack gap={4}>
                  <Text size="sm">{interaction.mechanism}</Text>
                  <Text size="sm" fw={500}>
                    Рекомендация: {interaction.recommendation}
                  </Text>
                  <Group gap="xs" mt={4}>
                    {[a, b].map((side) =>
                      side.drug ? (
                        <Button
                          key={side.inn}
                          size="compact-xs"
                          variant="subtle"
                          rightSection={<IconArrowRight size={12} />}
                          onClick={() => navigate(`/drugs/${side.drug!.id}`)}
                        >
                          {side.drug.inn}
                        </Button>
                      ) : null,
                    )}
                  </Group>
                </Stack>
              </Alert>
            ))}
          </Stack>
        )}

        {/* Весь список правил живёт на странице, а не в окне «управление списком». Врач приходит
            сюда и посмотреть, что вообще известно, — прятать тысячу правил за кнопкой значило бы
            держать содержимое раздела за дверью, а на самой странице оставлять пустое место. */}
        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md" wrap="wrap" gap="xs">
            <Group gap={8}>
              <ThemeIcon variant="light" color="brand" size={30} radius="md">
                <IconLink size={16} />
              </ThemeIcon>
              <Title order={4}>Все взаимодействия</Title>
            </Group>
            <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>
              Добавить взаимодействие
            </Button>
          </Group>

          <TextInput
            placeholder="Препарат или механизм…"
            leftSection={<IconSearch size={16} />}
            value={ruleSearch}
            onChange={(e) => setRuleSearch(e.currentTarget.value)}
          />
          <Text size="xs" c="dimmed" mt={6}>
            {ruleSearch.trim()
              ? `Найдено: ${matchedRules.length} из ${interactions.length}`
              : `Всего правил: ${interactions.length}`}
          </Text>

          {/* Рамка со своей прокруткой: тысяча правил, вытянутая в страницу, похоронила бы под
              собой саму проверку. Дозагрузка следит за меткой **внутри этой рамки** — наблюдатель,
              сравнивающий метку с окном, не увидел бы её никогда, потому что её обрезает край
              рамки. Ровно на этом «загружается ещё…» и висело, ничего не загружая. */}
          <Stack gap="xs" mt="sm" mah={420} style={{ overflowY: 'auto' }} ref={setRuleBox}>
            {matchedRules.length === 0 ? (
              <Text size="sm" c="dimmed">
                {interactions.length === 0 ? 'Список пуст.' : 'Ничего не найдено.'}
              </Text>
            ) : (
              rules.visible.map((interaction) => (
                <Group key={interaction.id} justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Group gap={6} wrap="wrap">
                      <Text size="sm" fw={500}>
                        {interaction.drugA} + {interaction.drugB}
                      </Text>
                      <Badge size="xs" color={SEVERITY_COLOR[interaction.severity]} variant="light">
                        {SEVERITY_LABELS[interaction.severity]}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {interaction.mechanism}
                    </Text>
                  </div>
                  <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(interaction.id)} aria-label="Удалить взаимодействие">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))
            )}
            {rules.hasMore && (
              <Text ref={rules.setSentinel} size="xs" c="dimmed" ta="center" py="xs">
                Загружается ещё… осталось {rules.remaining}
              </Text>
            )}
          </Stack>
        </Card>
      </Stack>

      <Modal opened={addOpen} onClose={() => setAddOpen(false)} title="Добавить взаимодействие" radius="lg" size="lg" centered>
        <Text size="sm" c="dimmed" mb="md">
          Указывайте МНН, а не торговое название: тогда правило сработает на любую упаковку из
          справочника.
        </Text>
        <InteractionForm innOptions={innOptions} onSubmit={addInteraction} onSaved={() => setAddOpen(false)} />
      </Modal>
    </>
  );
}

/** «Нурофен (Ибупрофен) + Варфарин» — echo back what was typed, name what it was understood as. */
function pairTitle(a: ResolvedDrug, b: ResolvedDrug, viaA?: string, viaB?: string): string {
  return `${sideLabel(a, viaA)} + ${sideLabel(b, viaB)}`;
}

/**
 * Сработавший компонент важнее полного состава комбинации.
 *
 * У «Ибуклина» МНН — «Ибупрофен/парацетамол», и подпись «Ибуклин (Ибупрофен/парацетамол)» не
 * отвечает на вопрос, который у врача возникает первым: при чём тут варфарин. «Ибуклин (в составе
 * ибупрофен)» отвечает — и заодно показывает, что предупреждение пришло от состава, а не от
 * правила, написанного на саму комбинацию.
 *
 * Формулировка именительная, и это не придирка: названия склоняются по-разному («по ибупрофену», но
 * «по ацетилсалициловой кислоте»), а склонять их в коде нечем.
 */
function sideLabel(side: ResolvedDrug, via?: string): string {
  const name = side.viaBrandName || !side.drug ? side.entered : side.drug.inn;
  if (via) return `${name} (в составе ${via.toLowerCase()})`;
  if (side.viaBrandName && side.drug) return `${side.entered} (${side.drug.inn})`;
  return side.drug?.inn ?? side.entered;
}

/**
 * Одно и то же вещество в двух препаратах списка — удвоение дозы, а не взаимодействие.
 *
 * Отдельным блоком, а не среди правил, и это осознанно: у остальных предупреждений есть правило с
 * механизмом и рекомендацией, а здесь правила нет и придумывать его нечем. Показывается выше
 * взаимодействий — сложенная доза парацетамола опаснее большинства пар в списке и при этом не
 * видна вовсе: обе упаковки приняты строго по инструкции.
 */
function SharedComponents({ shared }: { shared: SharedComponent[] }) {
  if (shared.length === 0) return null;
  return (
    <>
      {shared.map((item) => (
        <Alert
          key={item.component}
          variant="light"
          color="orange"
          icon={<IconAlertTriangle size={18} />}
          title={
            <Group gap={8} wrap="wrap">
              <Text fw={600} span>
                {item.component} — в нескольких препаратах сразу
              </Text>
              <Badge size="sm" color="orange" variant="filled">
                удвоение дозы
              </Badge>
            </Group>
          }
        >
          <Stack gap={4}>
            <Text size="sm">
              Это вещество входит в состав сразу нескольких препаратов списка:{' '}
              {item.drugs.map((drug) => drug.entered).join(', ')}. Суточная доза складывается, хотя каждая
              упаковка принимается по инструкции.
            </Text>
            <Text size="sm" fw={500}>
              Рекомендация: сложить суточные дозы и оставить один источник вещества.
            </Text>
          </Stack>
        </Alert>
      ))}
    </>
  );
}

/**
 * What the check actually understood.
 *
 * Silently resolving «Нурофен» to ибупрофен is the right behaviour but the wrong thing to hide: the
 * doctor has to be able to see that the substitution happened, and — more importantly — that a drug
 * they entered is *not* in the directory, so a missing warning has a visible reason.
 */
function ResolutionLine({ resolved }: { resolved: ResolvedDrug[] }) {
  if (resolved.length === 0) return null;

  const renamed = resolved.filter((item) => item.viaBrandName && item.drug);
  const unknown = resolved.filter((item) => !item.drug);

  if (renamed.length === 0 && unknown.length === 0) return null;

  return (
    <Stack gap={4} mt="sm">
      {renamed.map((item) => (
        <Text key={item.entered} size="xs" c="dimmed">
          {item.entered} → <b>{item.drug!.inn}</b>
          {item.drug!.pharmGroup ? `, ${item.drug!.pharmGroup}` : ''}
        </Text>
      ))}
      {unknown.length > 0 && (
        <Text size="xs" c="dimmed">
          Нет в справочнике: {unknown.map((item) => item.entered).join(', ')}. Проверка ищет это название как есть —{' '}
          <Anchor component={Link} to="/drugs/new" size="xs">
            добавьте препарат
          </Anchor>
          , чтобы связать его с торговыми названиями.
        </Text>
      )}
    </Stack>
  );
}
