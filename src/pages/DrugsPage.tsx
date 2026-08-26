import { useMemo, useState } from 'react';
import { Alert, Button, Card, Container, Group, Select, Skeleton, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconCategory, IconInfoCircle, IconPill, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { DrugCategoriesModal } from '../features/drugs/DrugCategoriesModal';
import { DRUG_SORT_KEYS, DrugTable, drugSortValue, type DrugSortKey } from '../features/drugs/DrugTable';
import type { DrugSummary } from '../features/drugs/types';
import { QUERY_KEY as DRUGS_KEY, useDrugs } from '../features/drugs/useDrugs';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { sortRows, useTableSort } from '../lib/tableSort';
import { buildDrugIndex, drugCategoryCounts, drugMatchesQuery, normalizeDrugName, resolveDrug } from '../features/drugs/drugIndex';
import { useDrugInteractions } from '../features/interactions/useDrugInteractions';

const ALL_CATEGORIES = '__all__';

export function DrugsPage() {
  const navigate = useNavigate();
  const { drugs, isLoading, deleteDrug } = useDrugs();
  const confirmDelete = useDeleteWithConfirm();
  const { interactions } = useDrugInteractions();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const { sort, toggle } = useTableSort<DrugSortKey>(
    { key: 'inn', direction: 'asc' },
    { storageKey: 'medassist:sort:drugs', keys: DRUG_SORT_KEYS },
  );

  const index = useMemo(() => buildDrugIndex(drugs), [drugs]);
  const categories = useMemo(() => drugCategoryCounts(drugs), [drugs]);

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
    () =>
      drugs.filter(
        (drug) =>
          (category === ALL_CATEGORIES || (drug.category.trim() || 'Без раздела') === category) &&
          drugMatchesQuery(drug, search),
      ),
    [drugs, search, category],
  );

  const sorted = useMemo(
    () => sortRows(filtered, sort, (drug, key) => drugSortValue(drug, key, interactionCounts, normalizeDrugName)),
    [filtered, sort, interactionCounts],
  );

  const isFiltering = search.trim() !== '' || category !== ALL_CATEGORIES;

  const handleDelete = (drug: DrugSummary) =>
    confirmDelete({
      what: 'препарат',
      name: drug.inn,
      notice: 'Препарат удалён из справочника',
      queryKey: DRUGS_KEY,
      id: drug.id,
      perform: () => deleteDrug(drug.id),
    });

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
              data={[
                { value: ALL_CATEGORIES, label: `Все разделы (${drugs.length})` },
                ...[...categories.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, count]) => ({ value: name, label: `${name} (${count})` })),
              ]}
              value={category}
              onChange={(value) => setCategory(value ?? ALL_CATEGORIES)}
              allowDeselect={false}
              w={280}
            />
            <Button
              variant="default"
              leftSection={<IconCategory size={18} />}
              onClick={() => setCategoriesOpen(true)}
            >
              Разделы
            </Button>
            <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/drugs/new')}>
              Добавить препарат
            </Button>
          </Group>
        </Group>

        {isLoading ? (
          <Stack gap="xs">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} h={44} radius="sm" />
            ))}
          </Stack>
        ) : filtered.length === 0 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                {isFiltering ? <IconX size={24} /> : <IconPill size={24} />}
              </ThemeIcon>
              <Text fw={600}>{isFiltering ? 'Ничего не найдено' : 'Справочник пуст'}</Text>
              <Text size="sm" c="dimmed" ta="center" maw={420}>
                {isFiltering
                  ? 'Попробуйте изменить запрос или снять фильтр по разделу.'
                  : 'Добавьте препараты, которые назначаете чаще всего — вместе с торговыми названиями, под которыми их знают пациенты.'}
              </Text>
            </Stack>
          </Card>
        ) : (
          <Card withBorder padding={0}>
            <DrugTable
              drugs={sorted}
              interactionCounts={interactionCounts}
              normalizeInn={normalizeDrugName}
              sort={sort}
              onSort={toggle}
              onOpen={(drug) => navigate(`/drugs/${drug.id}`)}
              onEdit={(drug) => navigate(`/drugs/${drug.id}/edit`)}
              onDelete={handleDelete}
            />
          </Card>
        )}
      </Stack>

      <DrugCategoriesModal
        opened={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        counts={categories}
      />
    </Container>
  );
}
