import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Container,
  Group,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconBuildingStore, IconCheck, IconDownload, IconSearch } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';

import { PageToolbar } from '../components/common/PageToolbar';
import { plural } from '../lib/plural';
import { useAuth } from '../features/auth/AuthContext';
import { useSpecialties } from '../features/specialties/useSpecialtyFilter';
import { installedPath, useStore, type StoreItem, type StoreKind } from '../features/store/useStore';

const KIND_LABEL: Record<StoreKind, string> = {
  analyzer: 'Анализатор',
  calculator: 'Калькулятор',
  questionnaire: 'Диагностика',
  template: 'Бланк',
  book: 'Источник',
};

const KIND_COLOR: Record<StoreKind, string> = {
  analyzer: 'grape',
  calculator: 'blue',
  questionnaire: 'teal',
  template: 'orange',
  book: 'indigo',
};

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
 * **Карточки, а не таблица, и это отступление от общего правила раздела «Плитка или строка».**
 * Правило говорит: плитка оправдана там, где в превью может быть картинка. Здесь картинки нет, но и
 * сравнивать нечего — читают **описание**, три-четыре строки прозы, по которым и решают, нужна ли
 * позиция. В колонку таблицы такой текст не помещается, а обрезанный до одной строки перестаёт быть
 * ответом на вопрос «что это». Так же устроены витрины, у которых ровно та же задача: галерея
 * шаблонов Notion, магазин расширений VS Code.
 */
export function StorePage() {
  const { items, isLoading, install } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState('');

  const user = useAuth();
  const specialties = useSpecialties();
  const specialty = user.specialty ? (specialties.find((s) => s.id === user.specialty) ?? null) : null;
  const [bySpecialty, setBySpecialty] = useLocalStorage({
    key: 'medassist:specialty-filter:store',
    defaultValue: false,
  });
  const specialtyActive = specialty !== null && bySpecialty;

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

  const hiddenBySpecialty = foundIgnoringSpecialty.length - visible.length;
  const installedCount = byKind.filter((item) => item.installed).length;

  /*
   * Своего `onError` здесь нет намеренно: ошибку мутации показывает общий обработчик в кэше
   * мутаций, и второй тост рядом с ним — это одно и то же сообщение дважды. Проверено в демо, где
   * установка отвечает отказом: тостов было два.
   */
  const handleInstall = (item: StoreItem) => {
    install.mutate(item, {
      onSuccess: () => notifications.show({ message: `«${item.title}» — добавлено`, color: 'teal' }),
    });
  };

  return (
    <Container size="xl" px={0}>
      <Box mb="lg">
        <PageToolbar
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
        >
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
            <Text size="sm" c="dimmed">
              {query || specialtyActive
                ? `Найдено: ${visible.length} из ${byKind.length}`
                : `${byKind.length} ${plural(byKind.length, 'позиция', 'позиции', 'позиций')}, установлено ${installedCount}`}
            </Text>
          </Group>
        </PageToolbar>
      </Box>

      <Stack gap="lg">
        {/*
          Спрятанного не видно, поэтому отбор обязан о себе говорить — то же правило, что в
          справочниках: пустой список при включённом тумблере врач прочитает как «такого нет».
        */}
        {specialtyActive && hiddenBySpecialty > 0 && visible.length > 0 && (
          <Text size="sm" c="dimmed">
            Отбор по специальности скрыл {hiddenBySpecialty} — {' '}
            <Text component="span" c="brand" style={{ cursor: 'pointer' }} onClick={() => setBySpecialty(false)}>
              показать всё
            </Text>
          </Text>
        )}

        {specialtyActive && visible.length === 0 && foundIgnoringSpecialty.length > 0 && (
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
        )}

        {!isLoading && visible.length === 0 && foundIgnoringSpecialty.length === 0 && (
          <Card withBorder padding="xl">
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
          </Card>
        )}

        {/* Карточка ростом со своё содержимое, а не с соседку по ряду: описания разной длины, и
            растянутая карточка превращается в прямоугольник с пустотой под текстом. */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg" style={{ alignItems: 'start' }}>
          {visible.map((item) => (
            <Card key={`${item.kind}:${item.key}`} withBorder padding="lg" radius="md">
              <Stack gap="xs">
                <Group gap="xs">
                  <Badge variant="light" color={KIND_COLOR[item.kind]}>
                    {KIND_LABEL[item.kind]}
                  </Badge>
                  {item.installed && (
                    <Badge variant="light" color="teal" leftSection={<IconCheck size={12} />}>
                      Установлено
                    </Badge>
                  )}
                  {item.price > 0 && (
                    <Badge variant="light" color="yellow">
                      {item.price} ₽
                    </Badge>
                  )}
                </Group>

                <Text fw={600}>{item.title}</Text>
                <Text size="sm" c="dimmed" lineClamp={4}>
                  {item.description}
                </Text>

                <Group mt="sm">
                  {item.installed ? (
                    <Button component={Link} to={installedPath(item)} variant="light" size="sm">
                      Открыть
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      leftSection={<IconDownload size={16} />}
                      loading={install.isPending && install.variables?.key === item.key}
                      onClick={() => handleInstall(item)}
                    >
                      Установить
                    </Button>
                  )}
                </Group>
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      </Stack>
    </Container>
  );
}
