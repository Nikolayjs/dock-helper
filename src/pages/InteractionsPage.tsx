import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Container,
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
import { IconAlertTriangle, IconArrowRight, IconInfoCircle, IconPill, IconPills, IconSearch, IconSettings, IconTrash } from '@tabler/icons-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { useDrugs } from '../features/drugs/useDrugs';
import { useIncrementalList } from '../lib/useIncrementalList';
import { buildDrugIndex, checkInteractions, getKnownDrugNames, resolveEnteredDrugs } from '../features/interactions/interactionEngine';
import type { ResolvedDrug } from '../features/interactions/interactionEngine';
import { SEVERITY_COLOR, SEVERITY_LABELS } from '../features/interactions/types';
import { InteractionForm } from '../features/interactions/InteractionForm';
import { QUERY_KEY as INTERACTIONS_KEY, useDrugInteractions } from '../features/interactions/useDrugInteractions';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

export function InteractionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { interactions, isLoading, addInteraction, deleteInteraction } = useDrugInteractions();
  const confirmDelete = useDeleteWithConfirm();
  const { drugs, isLoading: drugsLoading } = useDrugs();
  const [entered, setEntered] = useState<string[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [ruleSearch, setRuleSearch] = useState('');

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

  const rules = useIncrementalList(matchedRules, 40);

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

  const innOptions = useMemo(() => drugs.map((drug) => drug.inn).sort((a, b) => a.localeCompare(b, 'ru')), [drugs]);

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
    <Container size="lg" px={0}>
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
            <Group gap="xs" wrap="wrap">
              <Button
                component={Link}
                to="/drugs"
                variant="light"
                color="gray"
                size="xs"
                leftSection={<IconPill size={14} />}
              >
                Справочник препаратов
              </Button>
              <Button variant="light" color="gray" size="xs" leftSection={<IconSettings size={14} />} onClick={() => setManageOpen(true)}>
                Управление списком
              </Button>
            </Group>
          </Group>

          {isLoading || drugsLoading ? (
            <Skeleton h={36} radius="md" />
          ) : (
            <>
              <TagsInput
                placeholder="Название с упаковки или МНН — «Нурофен» тоже подойдёт…"
                data={knownDrugNames}
                limit={20}
                value={entered}
                onChange={setEntered}
                clearable
              />
              <ResolutionLine resolved={resolved} />
            </>
          )}
        </Card>

        {entered.length < 2 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="lg">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconPills size={24} />
              </ThemeIcon>
              <Text fw={600}>Добавьте минимум два препарата</Text>
              <Text size="sm" c="dimmed" ta="center" maw={460}>
                Взаимодействия проверяются попарно между всеми препаратами в списке выше. Можно вводить торговые
                названия — они распознаются по справочнику препаратов.
              </Text>
            </Stack>
          </Card>
        ) : matches.length === 0 ? (
          <Alert variant="light" color="teal" icon={<IconInfoCircle size={18} />} title="Известных взаимодействий не найдено">
            Среди введённых препаратов нет пар из текущего списка проверки. Это не означает полную безопасность
            комбинации — см. предупреждение выше.
          </Alert>
        ) : (
          <Stack gap="sm">
            {matches.map(({ interaction, a, b }) => (
              <Alert
                key={interaction.id}
                variant="light"
                color={SEVERITY_COLOR[interaction.severity]}
                icon={<IconAlertTriangle size={18} />}
                title={
                  <Group gap={8} wrap="wrap">
                    <Text fw={600} span>
                      {pairTitle(a, b)}
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
      </Stack>

      <Modal opened={manageOpen} onClose={() => setManageOpen(false)} title="Список взаимодействий" radius="lg" size="lg" centered>
        <Stack gap="lg">
          <TextInput
            placeholder="Препарат или механизм…"
            leftSection={<IconSearch size={16} />}
            value={ruleSearch}
            onChange={(e) => setRuleSearch(e.currentTarget.value)}
          />
          <Text size="xs" c="dimmed">
            {ruleSearch.trim()
              ? `Найдено: ${matchedRules.length} из ${interactions.length}`
              : `Всего правил: ${interactions.length}`}
          </Text>

          <Stack gap="xs" mah={320} style={{ overflowY: 'auto' }}>
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

          <Stack gap="sm">
            <Text size="sm" fw={500}>
              Добавить взаимодействие
            </Text>
            <InteractionForm innOptions={innOptions} onSubmit={addInteraction} />
          </Stack>
        </Stack>
      </Modal>
    </Container>
  );
}

/** «Нурофен (Ибупрофен) + Варфарин» — echo back what was typed, name what it was understood as. */
function pairTitle(a: ResolvedDrug, b: ResolvedDrug): string {
  return `${sideLabel(a)} + ${sideLabel(b)}`;
}

function sideLabel(side: ResolvedDrug): string {
  if (side.viaBrandName && side.drug) return `${side.entered} (${side.drug.inn})`;
  return side.drug?.inn ?? side.entered;
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
