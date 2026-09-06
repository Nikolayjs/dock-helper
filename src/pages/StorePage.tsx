import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Container,
  Group,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useLocalStorage, useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconBuildingStore, IconDownload, IconSearch } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';

import { CatalogPanel } from '../components/common/CatalogPanel';
import { plural } from '../lib/plural';
import { sortRows, useTableSort } from '../lib/tableSort';
import { useAuth } from '../features/auth/AuthContext';
import { useSpecialties } from '../features/specialties/useSpecialtyFilter';
import {
  StoreTable,
  STORE_SORT_KEYS,
  storeSortValue,
  type StoreSortKey,
} from '../features/store/StoreTable';
import { useStore, type StoreItem } from '../features/store/useStore';

const TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'Всё' },
  { value: 'analyzer', label: 'Анализаторы' },
  { value: 'calculator', label: 'Калькуляторы' },
  { value: 'questionnaire', label: 'Диагностика' },
  { value: 'template', label: 'Бланки' },
  { value: 'book', label: 'Источники' },
];

function matchesSearch(item: StoreItem, query: string): boolean {
  if (!query) return true;
  return item.title.toLowerCase().includes(query) || item.description.toLowerCase().includes(query);
}

/**
 * Магазин: заводской контент, который врач ставит себе сам.
 *
 * Раньше рабочее пространство получало **весь** заводской набор при регистрации: кардиологу
 * доставались сорок ЛОР- и педиатрических панелей, а педиатру — шкала ХОБЛ. Теперь при регистрации
 * ставится ядро, а остальное лежит здесь и ставится по одному.
 *
 * **Таблица, как и остальные списки приложения, — это смена прежнего решения.** Раньше здесь были
 * карточки, и довод был такой: читают описание в три-четыре строки прозы, а в колонку оно не
 * поместится. Довод не выдержал двух других. Позиций стало **132**, и сетка по три карточки в ряд —
 * это сорок с лишним рядов, которые просматриваются зигзагом вместо одного движения глаз сверху
 * вниз. А раздел, устроенный не так, как все прочие списки, заставляет заново искать глазами и
 * поиск, и сортировку, и кнопку. Описание при этом никуда не делось: оно стоит второй строкой под
 * названием и обрезается на двух, как у калькуляторов и документов.
 */
export function StorePage() {
  const { items, isLoading, install, installMany } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const user = useAuth();
  const specialties = useSpecialties();
  const specialty = user.specialty ? (specialties.find((s) => s.id === user.specialty) ?? null) : null;
  /**
   * Отбор по специальности включён с самого начала — если специальность известна.
   *
   * Ровно ради этого отбор и заводился: кардиолог, открывший магазин, видел все шестьдесят с лишним
   * позиций подряд — то есть ту самую задачу, от которой уходили. В справочниках тумблер выключен
   * по умолчанию, и это разные случаи: там отбор прячет **содержимое**, которое врач пришёл читать,
   * а здесь — витрину, из которой он выбирает себе набор. Спрятанное при этом названо числом и
   * снимается одним нажатием, как и везде.
   */
  const [bySpecialty, setBySpecialty] = useLocalStorage({
    key: 'medassist:specialty-filter:store',
    defaultValue: Boolean(user.specialty),
  });
  const specialtyActive = specialty !== null && bySpecialty;

  // На телефоне таблица из четырёх колонок требует бокового смахивания — там компактный список.
  const isNarrow = useMediaQuery('(max-width: 62em)');
  const { sort, toggle } = useTableSort<StoreSortKey>(
    { key: 'title', direction: 'asc' },
    { storageKey: 'medassist:sort:store', keys: STORE_SORT_KEYS },
  );

  // Вкладка живёт в адресе, а не в состоянии: ссылка на раздел магазина обязана открывать тот самый
  // раздел — та же причина, что у вкладок «Документов» и «Справочника».
  const tab = TABS.some((t) => t.value === searchParams.get('tab')) ? (searchParams.get('tab') as string) : 'all';
  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'all') next.delete('tab');
    else next.set('tab', value);
    setSearchParams(next, { replace: true });
  };

  const query = search.trim().toLowerCase();

  const byKind = useMemo(() => items.filter((item) => tab === 'all' || item.kind === tab), [items, tab]);

  /** Тот же набор без отбора по специальности — иначе нечем сказать, сколько он спрятал. */
  const foundIgnoringSpecialty = useMemo(() => byKind.filter((item) => matchesSearch(item, query)), [byKind, query]);

  const visible = useMemo(
    () =>
      foundIgnoringSpecialty.filter(
        (item) =>
          !specialtyActive ||
          // Пустой список специальностей значит «всем»: ИМТ и общий анализ крови не принадлежат ни
          // одной, и прятать их за отбором значило бы спрятать самое ходовое.
          item.specialties.length === 0 ||
          item.specialties.includes(specialty!.id),
      ),
    [foundIgnoringSpecialty, specialtyActive, specialty],
  );

  const sorted = useMemo(() => sortRows(visible, sort, storeSortValue), [visible, sort]);

  const hiddenBySpecialty = foundIgnoringSpecialty.length - visible.length;
  const installedCount = byKind.filter((item) => item.installed).length;

  /*
   * Своего `onError` здесь нет намеренно: ошибку мутации показывает общий обработчик в кэше
   * мутаций, и второй тост рядом с ним — это одно и то же сообщение дважды. Проверено в демо, где
   * установка отвечает отказом: тостов было два.
   */
  /** Что ещё не стоит из показанного: ровно это и ставит кнопка «поставить набор». */
  const notInstalled = useMemo(() => visible.filter((item) => !item.installed), [visible]);

  const handleInstallAll = () => {
    installMany.mutate(notInstalled, {
      onSuccess: ({ installed }) =>
        notifications.show({
          message: installed === 0 ? 'Ставить нечего' : `Добавлено: ${installed}`,
          color: 'teal',
        }),
    });
  };

  const handleInstall = (item: StoreItem) => {
    install.mutate(item, {
      onSuccess: () => notifications.show({ message: `«${item.title}» — добавлено`, color: 'teal' }),
    });
  };

  return (
    <Container size="xl" px={0}>
      {/* Одна панель на всё: вкладки, поиск, отбор, кнопка набора, счётчик и сам список. */}
      <CatalogPanel
        tabs={
          <Tabs value={tab} onChange={(v) => setTab(v ?? 'all')} variant="pills">
            <Tabs.List>
              {TABS.map((item) => (
                <Tabs.Tab key={item.value} value={item.value}>
                  {item.label}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        }
        header={
          <Stack gap="sm">
            <Group justify="space-between" wrap="wrap" gap="md">
              <Group gap="md" wrap="wrap">
                <TextInput
                  placeholder="Поиск по магазину…"
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  w={260}
                />
                {specialty && (
                  <Switch
                    label="Моя специальность"
                    checked={bySpecialty}
                    onChange={(e) => setBySpecialty(e.currentTarget.checked)}
                  />
                )}
              </Group>
              <Group gap="sm" wrap="wrap">
                {/*
                  «Поставить всё» появляется только при включённом отборе и только когда есть что
                  ставить: без отбора это значило бы вывалить врачу весь каталог — ровно то, от чего
                  магазин и уходил. Ставится одним запросом: по одному ограничитель на сервере
                  оборвал бы набор на середине.
                */}
                {specialtyActive && notInstalled.length > 0 && (
                  <Button
                    size="xs"
                    variant="light"
                    leftSection={<IconDownload size={14} />}
                    loading={installMany.isPending}
                    onClick={handleInstallAll}
                  >
                    Поставить набор для специальности ({notInstalled.length})
                  </Button>
                )}
                <Text size="sm" c="dimmed">
                  {query || specialtyActive
                    ? `Найдено: ${visible.length} из ${byKind.length}`
                    : `${byKind.length} ${plural(byKind.length, 'позиция', 'позиции', 'позиций')}, установлено ${installedCount}`}
                </Text>
              </Group>
            </Group>

            {/*
              Спрятанного не видно, поэтому отбор обязан о себе говорить — то же правило, что в
              справочниках: пустой список при включённом тумблере врач прочитает как «такого нет».
            */}
            {specialtyActive && hiddenBySpecialty > 0 && visible.length > 0 && (
              <Text size="sm" c="dimmed">
                Отбор по специальности скрыл {hiddenBySpecialty} —{' '}
                <Text component="span" c="brand" style={{ cursor: 'pointer' }} onClick={() => setBySpecialty(false)}>
                  показать всё
                </Text>
              </Text>
            )}
          </Stack>
        }
      >
        {specialtyActive && visible.length === 0 && foundIgnoringSpecialty.length > 0 && (
          <Box p="md">
            <Alert color="yellow" variant="light">
              <Group justify="space-between" wrap="wrap" gap="sm">
                <Text size="sm">
                  Отбор по специальности «{specialty?.name}» скрыл всё: без него нашлось{' '}
                  {foundIgnoringSpecialty.length}.
                </Text>
                <Button size="xs" variant="light" onClick={() => setBySpecialty(false)}>
                  Показать всё
                </Button>
              </Group>
            </Alert>
          </Box>
        )}

        {!isLoading && visible.length === 0 && foundIgnoringSpecialty.length === 0 && (
          <Box p="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconBuildingStore size={24} />
              </ThemeIcon>
              <Text fw={600}>Ничего не нашлось</Text>
              <Text size="sm" c="dimmed" ta="center" maw={360}>
                Поищите по другому слову — в магазине лежат анализаторы, калькуляторы, диагностические
                панели и бланки.
              </Text>
            </Stack>
          </Box>
        )}

        {sorted.length > 0 && (
          <StoreTable
            items={sorted}
            sort={sort}
            onSort={toggle}
            onInstall={handleInstall}
            installingKey={install.isPending ? install.variables?.key : undefined}
            narrow={isNarrow}
          />
        )}
      </CatalogPanel>
    </Container>
  );
}
