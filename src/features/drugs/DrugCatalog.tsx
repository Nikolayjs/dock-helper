import { useMemo, useState } from 'react';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { Alert, Button, Card, Group, Select, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconCategory, IconInfoCircle, IconPill, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { DrugCategoriesModal } from './DrugCategoriesModal';
import { DrugList } from './DrugList';
import { DRUG_SORT_KEYS, DrugTable, drugSortValue, type DrugSortKey } from './DrugTable';
import type { DrugSummary } from './types';
import { QUERY_KEY as DRUGS_KEY, useDrugs } from './useDrugs';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { sortRows, useTableSort } from '../../lib/tableSort';
import { buildDrugIndex, drugCategoryCounts, drugMatchesQuery, normalizeDrugName, resolveDrug } from './drugIndex';
import { useDrugInteractions } from '../interactions/useDrugInteractions';
import { QueryState } from '../../components/common/QueryState';
import { SpecialtyFilterNotice, SpecialtyFilterSwitch } from '../specialties/SpecialtyFilterControls';
import { useSpecialtyFilter } from '../specialties/useSpecialtyFilter';

const ALL_CATEGORIES = '__all__';

export function DrugCatalog() {
  const navigate = useNavigate();
  const { drugs, isLoading, error, refetch, deleteDrug } = useDrugs();
  const confirmDelete = useDeleteWithConfirm();
  const { interactions } = useDrugInteractions();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const specialtyFilter = useSpecialtyFilter('drugs');

  /**
   * На телефоне таблица из семи колонок разворачивается в 1200 пикселей и требует бокового
   * смахивания ради каждого поля, кроме первого, — там вместо неё компактный список.
   */
  const isNarrow = useMediaQuery('(max-width: 62em)');

  // Пояснение занимает весь первый экран телефона, а прочитать его достаточно один раз.
  const [introHidden, setIntroHidden] = useLocalStorage({
    key: 'medassist:drugs:intro-hidden',
    defaultValue: false,
  });
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

  /**
   * Отбор считается дважды: со специальностью и без неё.
   *
   * Второй набор нужен не для показа, а для честности: только зная, сколько записей подошло бы без
   * отбора, страница может сказать «скрыто 812 препаратов» вместо того, чтобы молча показать
   * короткий список. Разница между двумя проходами по полутора тысячам строк — доли миллисекунды,
   * а между «скрыто» и молчанием — доверие к результату.
   */
  const withoutSpecialty = useMemo(
    () =>
      drugs.filter(
        (drug) =>
          (category === ALL_CATEGORIES || (drug.category.trim() || 'Без раздела') === category) &&
          drugMatchesQuery(drug, search),
      ),
    [drugs, search, category],
  );

  const filtered = useMemo(
    () =>
      specialtyFilter.active
        ? withoutSpecialty.filter((drug) => specialtyFilter.matches(drug.category.trim()))
        : withoutSpecialty,
    [withoutSpecialty, specialtyFilter],
  );

  const sorted = useMemo(
    () => sortRows(filtered, sort, (drug, key) => drugSortValue(drug, key, interactionCounts, normalizeDrugName)),
    [filtered, sort, interactionCounts],
  );

  const isFiltering = search.trim() !== '' || category !== ALL_CATEGORIES || specialtyFilter.active;

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
    <>
      <Stack gap="lg">
        {!introHidden && (
          <Alert
            variant="light"
            color="brand"
            icon={<IconInfoCircle size={18} />}
            title="Зачем этот раздел"
            withCloseButton
            closeButtonLabel="Больше не показывать"
            onClose={() => setIntroHidden(true)}
          >
            Карточка препарата — это ещё и словарь торговых названий. Пациент говорит «Нурофен», а правила
            взаимодействий написаны на МНН: пока эти два названия связаны здесь, проверка на соседней
            вкладке срабатывает на то, что назвал пациент. Дозы приведены как памятка и не заменяют
            инструкцию к препарату.
          </Alert>
        )}

        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={4}>
            <Text c="dimmed" size="sm">
              {isFiltering ? `Найдено: ${filtered.length} из ${drugs.length}` : `${drugs.length} препаратов в справочнике`}
            </Text>
            <SpecialtyFilterNotice
              filter={specialtyFilter}
              hidden={withoutSpecialty.length - filtered.length}
              visible={filtered.length}
              unit={['препарат', 'препарата', 'препаратов']}
            />
          </Stack>
          <Group gap="sm" wrap="wrap">
            <SpecialtyFilterSwitch filter={specialtyFilter} />
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

        <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="справочник">
          {filtered.length === 0 ? (
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
              {isNarrow ? (
                <DrugList
                  drugs={sorted}
                  interactionCounts={interactionCounts}
                  normalizeInn={normalizeDrugName}
                  onOpen={(drug) => navigate(`/drugs/${drug.id}`)}
                  onEdit={(drug) => navigate(`/drugs/${drug.id}/edit`)}
                />
              ) : (
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
              )}
            </Card>
          )}
        </QueryState>
      </Stack>

      <DrugCategoriesModal
        opened={categoriesOpen}
        onClose={() => setCategoriesOpen(false)}
        counts={categories}
      />
    </>
  );
}
