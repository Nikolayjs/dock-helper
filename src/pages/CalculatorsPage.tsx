import { useMemo, useState } from 'react';
import { Alert, Anchor, Box, Button, Container, Group, Stack, Tabs, Text, TextInput, ThemeIcon } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconBuildingStore, IconCalculatorOff, IconInfoCircle, IconPlus, IconSearch, IconX } from '@tabler/icons-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { CatalogPanel } from '../components/common/CatalogPanel';

import {
  CALCULATOR_SORT_KEYS,
  CalculatorTable,
  calculatorSortValue,
  type CalculatorSortKey,
} from '../features/calculators/CalculatorTable';
import { CALCULATOR_CATEGORIES, CATEGORY_COLORS } from '../features/calculators/types';
import { useCalculators } from '../features/calculators/useCalculators';
import { usePatients } from '../features/patients/usePatients';
import { QueryState } from '../components/common/QueryState';
import { sortRows, useTableSort } from '../lib/tableSort';

export function CalculatorsPage() {
  const navigate = useNavigate();
  const { calculators, toggleFavourite, isLoading, error, refetch } = useCalculators();
  /**
   * Пациент едет через список калькуляторов дальше, в сам калькулятор.
   *
   * Меню калькуляторов в карточке пациента было бы вторым их списком — с поиском, разделами и
   * звёздочками, которые пришлось бы повторить. Проще провести пациента через тот, что уже есть.
   */
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId');
  const { patients } = usePatients();
  const forPatient = patientId ? patients.find((patient) => patient.id === patientId) : undefined;
  const withPatient = (path: string) => (patientId ? `${path}?patientId=${patientId}` : path);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  // На телефоне таблица из трёх колонок требует бокового смахивания — там компактный список.
  const isNarrow = useMediaQuery('(max-width: 62em)');
  const { sort, toggle } = useTableSort<CalculatorSortKey>(
    { key: 'favourite', direction: 'asc' },
    { storageKey: 'medassist:sort:calculators', keys: CALCULATOR_SORT_KEYS },
  );

  const filtered = useMemo(() => {
    return calculators.filter((calc) => {
      const matchesCategory = category === 'all' ? true : calc.category === category;
      const matchesSearch =
        !search.trim() ||
        calc.title.toLowerCase().includes(search.toLowerCase()) ||
        calc.description.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [calculators, search, category]);

  const sorted = useMemo(() => sortRows(filtered, sort, calculatorSortValue), [filtered, sort]);

  const isFiltering = search.trim() !== '' || category !== 'all';

  const usedCategories = useMemo(() => {
    const present = new Set(calculators.map((calc) => calc.category));
    const known = CALCULATOR_CATEGORIES.filter((c) => present.has(c));
    const custom = [...present]
      .filter((c) => !(CALCULATOR_CATEGORIES as readonly string[]).includes(c))
      .sort((a, b) => a.localeCompare(b, 'ru'));
    return [...known, ...custom];
  }, [calculators]);

  return (
    <Container size="xl" px={0}>
      {/* Промежуток между панелью и плитками задаёт общий `Stack`, как на остальных страницах
          разделов: без него панель и первый ряд карточек стояли впритык. */}
      {/* Одна панель на всё: счётчик, поиск, кнопка, разделы и сам список. Отдельной карточкой
          сверху счётчик с кнопкой занимали целую полосу экрана ради одной строки текста. */}
      <CatalogPanel
        header={
          <Stack gap="sm">
          <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
            <Text c="dimmed" size="sm">
              {/* Пока ничего не отобрано, число ни о чём не говорит — но как только врач ищет или
                  выбрал раздел, «сколько из скольких» объясняет короткий список. */}
              {isFiltering
                ? `Найдено: ${filtered.length} из ${calculators.length}`
                : `${calculators.length} калькуляторов доступно`}
            </Text>
            <Group gap="sm" wrap="wrap">
              <TextInput
                placeholder="Поиск калькулятора…"
                leftSection={<IconSearch size={16} />}
                value={search}
                onChange={(e) => setSearch(e.currentTarget.value)}
                w={260}
              />
              <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/calculators/new')}>
                Создать калькулятор
              </Button>
              <Button
                variant="subtle"
                leftSection={<IconBuildingStore size={18} />}
                onClick={() => navigate('/store?tab=calculator')}
              >
                Ещё в магазине
              </Button>
            </Group>
          </Group>

          <Tabs value={category} onChange={(v) => setCategory(v ?? 'all')} variant="pills">
            <Tabs.List>
              <Tabs.Tab value="all">Все</Tabs.Tab>
              {usedCategories.map((c) => (
                <Tabs.Tab key={c} value={c}>
                  {c}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
          </Stack>
        }
      >
      {/* Кого считаем — видно до того, как калькулятор открыт: иначе подстановка на следующей
          странице выглядела бы взявшейся из ниоткуда. */}
      {forPatient && (
        <Box px="md" pt="md">
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="md">
              <Text size="sm">
                Расчёт для пациента{' '}
                <Anchor component={Link} to={`/patients/${forPatient.id}`}>
                  {forPatient.fullName}
                </Anchor>
                : поля калькулятора заполнятся из карточки, а результат можно будет записать в визит.
              </Text>
              {/* Выйти из расчёта «по пациенту» нечем, кроме как править адрес руками: врач приходит
                  сюда из карточки, а дальше считает уже своё. `replace` — чтобы кнопка браузера
                  «назад» не возвращала пациента, которого только что убрали. */}
              <Button
                size="xs"
                variant="subtle"
                color="gray"
                leftSection={<IconX size={14} />}
                onClick={() => navigate('/calculators', { replace: true })}
                style={{ flexShrink: 0 }}
              >
                Очистить
              </Button>
            </Group>
          </Alert>
        </Box>
      )}

      <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="калькуляторы">
        {filtered.length === 0 ? (
          <Box p="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconCalculatorOff size={24} />
              </ThemeIcon>
              <Text fw={600}>Ничего не найдено</Text>
              <Text size="sm" c="dimmed">
                Попробуйте изменить запрос или создайте свой калькулятор.
              </Text>
            </Stack>
          </Box>
        ) : (
          <CalculatorTable
            calculators={sorted}
            sort={sort}
            onSort={toggle}
            onOpen={(calc) => navigate(withPatient(`/calculators/${calc.id}`))}
            onToggleFavourite={toggleFavourite}
            categoryColor={(category) => CATEGORY_COLORS[category] ?? 'brand'}
            narrow={isNarrow}
          />
        )}
      </QueryState>
      </CatalogPanel>
    </Container>
  );
}
