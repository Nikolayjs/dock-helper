import { useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { ActionIcon, Alert, Badge, Box, Group, Loader, Stack, Table, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconChevronRight, IconInfoCircle, IconSearch, IconStethoscope, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { CatalogPanel } from '../../components/common/CatalogPanel';
import { SortableTh } from '../../components/common/SortableTh';
import { useIncrementalList } from '../../lib/useIncrementalList';
import { sortRows, useTableSort } from '../../lib/tableSort';
import type { SortValue } from '../../lib/tableSort';
import { SpecialtyFilterNotice, SpecialtyFilterSwitch } from '../specialties/SpecialtyFilterControls';
import { useSpecialtyFilter } from '../specialties/useSpecialtyFilter';
import { useGuidelines } from './useGuidelines';
import type { GuidelineSummary } from './types';

/**
 * Клинические рекомендации — таблицей, как формуляр препаратов.
 *
 * Их семьсот с лишним; плитками такое нельзя ни просмотреть, ни сравнить, а нужен здесь беглый
 * поиск по названию и по коду МКБ — врач приходит либо со словом из выписки, либо с кодом из
 * реестра.
 *
 * **Отбор по специальности идёт по блокам МКБ-10, а не по нашим разделам.** Разделов у этих
 * документов нет вовсе: они не наши, тегов им никто не проставлял. Зато у каждого есть коды, а
 * специальность уже описана блоками классификации (`specialties.icdBlocks`) — тем же механизмом,
 * которым отбирается сам справочник МКБ-10. Блок по коду считает сервер: возить ради фильтра всю
 * классификацию в браузер незачем.
 */

type GuidelineSortKey = 'name' | 'mkb' | 'age' | 'developer' | 'published';
const SORT_KEYS: readonly GuidelineSortKey[] = ['name', 'mkb', 'age', 'developer', 'published'];

function sortValue(row: GuidelineSummary, key: GuidelineSortKey): SortValue {
  switch (key) {
    case 'name':
      return row.name;
    case 'mkb':
      return row.mkbCodes[0] ?? null;
    case 'age':
      return row.ageGroup || null;
    case 'developer':
      return row.developers[0] ?? null;
    case 'published':
      return row.publishDate || null;
  }
}

/** Дата размещения — строкой из рубрикатора (`2026-09-04T16:21:21`), показываем без времени. */
function published(value: string): string {
  const date = value.slice(0, 10).split('-');
  return date.length === 3 ? `${date[2]}.${date[1]}.${date[0]}` : value;
}

/**
 * Данные каталог берёт сам, как соседние вкладки справочника.
 *
 * Раньше их передавала своя страница `/guidelines`; страницы больше нет — рекомендации переехали
 * вкладкой в «Справочник», и держать посредника, чья работа состоит из одного запроса и спиннера,
 * стало незачем.
 */
export function GuidelinesCatalog() {
  const navigate = useNavigate();
  const { guidelines, isLoading, error } = useGuidelines();
  const [search, setSearch] = useState('');
  const specialtyFilter = useSpecialtyFilter('icd');
  const isNarrow = useMediaQuery('(max-width: 62em)');
  const { sort, toggle } = useTableSort<GuidelineSortKey>(
    { key: 'name', direction: 'asc' },
    { storageKey: 'medassist:sort:clinical-guidelines', keys: SORT_KEYS },
  );

  // Считается дважды — со специальностью и без. Второй набор нужен, чтобы сказать, сколько
  // рекомендаций отбор спрятал: молча показанный короткий список читается как весь справочник.
  const withoutSpecialty = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return guidelines;
    return guidelines.filter(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.mkbCodes.some((code) => code.toLowerCase().startsWith(query)) ||
        row.developers.some((developer) => developer.toLowerCase().includes(query)),
    );
  }, [guidelines, search]);

  const filtered = useMemo(
    () =>
      specialtyFilter.active
        ? withoutSpecialty.filter((row) => row.icdBlocks.some((block) => specialtyFilter.matches(block)))
        : withoutSpecialty,
    [withoutSpecialty, specialtyFilter],
  );

  const sorted = useMemo(() => sortRows(filtered, sort, sortValue), [filtered, sort]);
  const { visible, hasMore, remaining, setSentinel } = useIncrementalList(sorted);
  const isFiltering = search.trim().length > 0 || specialtyFilter.active;

  /*
   * Открытие — навигация отсюда, а не колбэк наружу: у карточки один адрес, и знать его должен тот,
   * кто рисует строку. Происхождение проставляется явно, чтобы кнопка «назад» на карточке вернула
   * во вкладку справочника, а не в свой раздел — раздела у рекомендаций больше нет.
   */
  const open = (row: GuidelineSummary) =>
    navigate(`/guidelines/${row.codeVersion}`, { state: { from: '/reference?tab=guidelines' } });

  // Ветки состояния стоят после всех хуков: порядок вызова хуков менять нельзя.
  if (error) {
    return (
      <Alert color="orange" icon={<IconInfoCircle size={18} />}>
        {error.message}
      </Alert>
    );
  }
  if (isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader size="sm" />
      </Group>
    );
  }

  return (
    <CatalogPanel
      header={
        <Group justify="space-between" align="flex-end" wrap="wrap">
          <Stack gap={4}>
            <Text c="dimmed" size="sm">
              {isFiltering
                ? `Найдено: ${filtered.length} из ${guidelines.length}`
                : `${guidelines.length} клинических рекомендаций Минздрава России`}
            </Text>
            <SpecialtyFilterNotice
              filter={specialtyFilter}
              hidden={withoutSpecialty.length - filtered.length}
              visible={filtered.length}
              unit={['рекомендацию', 'рекомендации', 'рекомендаций']}
            />
          </Stack>
          <Group gap="sm" wrap="wrap">
            <SpecialtyFilterSwitch filter={specialtyFilter} />
            <TextInput
              placeholder="Название или код МКБ-10"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              rightSection={
                search ? (
                  <ActionIcon variant="subtle" color="gray" aria-label="Очистить поиск" onClick={() => setSearch('')}>
                    <IconX size={14} />
                  </ActionIcon>
                ) : null
              }
              w={{ base: '100%', sm: 280 }}
            />
          </Group>
        </Group>
      }
    >
      {sorted.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <ThemeIcon variant="light" color="gray" size={48} radius="xl">
            <IconStethoscope size={24} />
          </ThemeIcon>
          <Text c="dimmed" size="sm">
            {guidelines.length === 0
              ? 'Рекомендации ещё не привезены из рубрикатора Минздрава.'
              : 'Ничего не нашлось. Попробуйте другое название или код.'}
          </Text>
        </Stack>
      ) : isNarrow ? (
        /* На телефоне пять столбцов требуют бокового смахивания ради каждого, кроме первого. */
        <Stack gap={0}>
          {visible.map((row) => (
            <Box
              key={row.codeVersion}
              onClick={() => open(row)}
              style={{ cursor: 'pointer', padding: '10px 16px', borderTop: '1px solid var(--mantine-color-default-border)' }}
            >
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm" fw={500} lineClamp={2}>
                  {row.name}
                </Text>
                <IconChevronRight size={16} style={{ flexShrink: 0, opacity: 0.5 }} />
              </Group>
              <Text size="xs" c="dimmed" mt={2}>
                {row.mkbCodes.slice(0, 4).join(', ') || '—'}
                {row.ageGroup ? ` · ${row.ageGroup}` : ''}
              </Text>
            </Box>
          ))}
          {hasMore && (
            <Text ref={setSentinel} size="xs" c="dimmed" ta="center" py="sm">
              Загружается ещё… осталось {remaining}
            </Text>
          )}
        </Stack>
      ) : (
        <>
          <Table.ScrollContainer minWidth={720}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <SortableTh sort={sort} column="name" onSort={toggle}>
                    Рекомендация
                  </SortableTh>
                  <SortableTh sort={sort} column="mkb" onSort={toggle}>
                    МКБ-10
                  </SortableTh>
                  <SortableTh sort={sort} column="age" onSort={toggle}>
                    Кому
                  </SortableTh>
                  <SortableTh sort={sort} column="developer" onSort={toggle}>
                    Разработчик
                  </SortableTh>
                  <SortableTh sort={sort} column="published" onSort={toggle}>
                    Размещена
                  </SortableTh>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {visible.map((row) => (
                  <Table.Tr key={row.codeVersion} style={{ cursor: 'pointer' }} onClick={() => open(row)}>
                    <Table.Td>
                      <Text size="sm" fw={500}>
                        {row.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="wrap">
                        {row.mkbCodes.slice(0, 4).map((code) => (
                          <Badge key={code} size="xs" variant="light" color="gray">
                            {code}
                          </Badge>
                        ))}
                        {row.mkbCodes.length > 4 && (
                          <Text size="xs" c="dimmed">
                            +{row.mkbCodes.length - 4}
                          </Text>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {row.ageGroup || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" lineClamp={2}>
                        {row.developers.join(', ') || '—'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {published(row.publishDate)}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {hasMore && (
            <Text ref={setSentinel} size="xs" c="dimmed" ta="center" py="sm">
              Загружается ещё… осталось {remaining}
            </Text>
          )}
        </>
      )}
    </CatalogPanel>
  );
}
