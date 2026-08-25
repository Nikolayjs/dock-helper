import { useMemo, useState } from 'react';
import { Alert, Button, Card, Container, Group, Select, SimpleGrid, Skeleton, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconInfoCircle, IconPill, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { DrugCard } from '../features/drugs/DrugCard';
import { buildDrugIndex, drugGroups, drugMatchesQuery, normalizeDrugName, resolveDrug } from '../features/drugs/drugIndex';
import { useDrugs } from '../features/drugs/useDrugs';
import { useDrugInteractions } from '../features/interactions/useDrugInteractions';

const ALL_GROUPS = '__all__';

export function DrugsPage() {
  const navigate = useNavigate();
  const { drugs, isLoading } = useDrugs();
  const { interactions } = useDrugInteractions();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<string>(ALL_GROUPS);

  const index = useMemo(() => buildDrugIndex(drugs), [drugs]);
  const groups = useMemo(() => drugGroups(drugs), [drugs]);

  /** How many rules mention each МНН — the badge that tells a doctor which drugs need care. */
  const interactionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const interaction of interactions) {
      for (const inn of new Set([resolveDrug(interaction.drugA, index).inn, resolveDrug(interaction.drugB, index).inn])) {
        counts.set(inn, (counts.get(inn) ?? 0) + 1);
      }
    }
    return counts;
  }, [interactions, index]);

  const filtered = useMemo(
    () => drugs.filter((drug) => (group === ALL_GROUPS || drug.pharmGroup === group) && drugMatchesQuery(drug, search)),
    [drugs, search, group],
  );

  const isFiltering = search.trim() !== '' || group !== ALL_GROUPS;

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} />} title="Зачем этот раздел">
          Карточка препарата — это ещё и словарь торговых названий. Пациент говорит «Нурофен», а правила
          взаимодействий написаны на МНН: пока эти два названия связаны здесь, проверка в разделе
          «Взаимодействия» срабатывает на то, что назвал пациент. Дозы приведены как памятка и не заменяют
          инструкцию к препарату.
        </Alert>

        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Text c="dimmed" size="sm">
            {isFiltering ? `Найдено: ${filtered.length} из ${drugs.length}` : `${drugs.length} препаратов в справочнике`}
          </Text>
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="МНН, торговое название, группа…"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
              w={280}
            />
            <Select
              data={[{ value: ALL_GROUPS, label: 'Все группы' }, ...groups.map((g) => ({ value: g, label: g }))]}
              value={group}
              onChange={(value) => setGroup(value ?? ALL_GROUPS)}
              allowDeselect={false}
              searchable
              w={260}
            />
            <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/drugs/new')}>
              Добавить препарат
            </Button>
          </Group>
        </Group>

        {isLoading ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} h={132} radius="md" />
            ))}
          </SimpleGrid>
        ) : filtered.length === 0 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                {isFiltering ? <IconX size={24} /> : <IconPill size={24} />}
              </ThemeIcon>
              <Text fw={600}>{isFiltering ? 'Ничего не найдено' : 'Справочник пуст'}</Text>
              <Text size="sm" c="dimmed" ta="center" maw={420}>
                {isFiltering
                  ? 'Попробуйте изменить запрос или снять фильтр по группе.'
                  : 'Добавьте препараты, которые назначаете чаще всего — вместе с торговыми названиями, под которыми их знают пациенты.'}
              </Text>
            </Stack>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {filtered.map((drug) => (
              <DrugCard
                key={drug.id}
                drug={drug}
                interactionCount={interactionCounts.get(normalizeDrugName(drug.inn)) ?? 0}
                onOpen={() => navigate(`/drugs/${drug.id}`)}
              />
            ))}
          </SimpleGrid>
        )}
      </Stack>
    </Container>
  );
}
