import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Center,
  Container,
  Group,
  Loader,
  Modal,
  SimpleGrid,
  Skeleton,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useIntersection } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconNews, IconPlus, IconRefresh, IconSettings, IconTrash } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { NewsCard } from '../features/newsFeed/NewsCard';
import { discoverFeed } from '../features/newsFeed/discoverFeed';
import type { NewsFeedItem } from '../features/newsFeed/types';
import { useNewsFeedItems } from '../features/newsFeed/useNewsFeedItems';
import { useNewsFeedSources } from '../features/newsFeed/useNewsFeedSources';

const PAGE_SIZE = 12;

export function NewsPage() {
  const navigate = useNavigate();
  const { sources, addSource, removeSource } = useNewsFeedSources();
  const { bySource, allItems, isLoading, refetchAll } = useNewsFeedItems(sources);

  const [activeSourceId, setActiveSourceId] = useState<string>('all');
  const [manageOpen, setManageOpen] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isAddingSource, setIsAddingSource] = useState(false);

  const visibleItems = useMemo(() => {
    if (activeSourceId === 'all') return allItems;
    return allItems.filter((item) => item.sourceId === activeSourceId);
  }, [allItems, activeSourceId]);

  // Lazy-render the (already-fetched) feed in batches — RSS feeds don't paginate server-side, so
  // "loading more" here means revealing more of what's already in memory as the sentinel scrolls
  // into view, not another network request.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeSourceId]);

  const { ref: sentinelRef, entry } = useIntersection({ threshold: 0.1 });
  const hasMore = visibleCount < visibleItems.length;
  useEffect(() => {
    if (entry?.isIntersecting && hasMore) {
      setVisibleCount((count) => Math.min(count + PAGE_SIZE, visibleItems.length));
    }
  }, [entry?.isIntersecting, hasMore, visibleItems.length]);

  const shownItems = visibleItems.slice(0, visibleCount);

  const failedSources = bySource.filter((s) => s.isError);

  const handleAddSource = async () => {
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) return;

    setIsAddingSource(true);
    try {
      // Accepts either a raw feed link or a site's homepage — discoverFeed resolves the latter
      // via the page's own <link rel="alternate"> feed announcement.
      const discovered = await discoverFeed(trimmedUrl);
      await addSource({ url: discovered.feedUrl, title: newTitle.trim() || discovered.title || trimmedUrl });
      setNewUrl('');
      setNewTitle('');
      notifications.show({ message: 'Источник добавлен', color: 'teal' });
    } catch (error) {
      notifications.show({
        message: error instanceof Error ? error.message : 'Не удалось добавить источник',
        color: 'red',
      });
    } finally {
      setIsAddingSource(false);
    }
  };

  const handleRemoveSource = async (id: string) => {
    await removeSource(id);
    if (activeSourceId === id) setActiveSourceId('all');
    notifications.show({ message: 'Источник удалён', color: 'gray' });
  };

  const handleOpenItem = (item: NewsFeedItem) => {
    const params = new URLSearchParams({ url: item.link, title: item.title, source: item.sourceTitle });
    navigate(`/news/read?${params.toString()}`);
  };

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap" gap="md">
          <Tabs value={activeSourceId} onChange={(v) => setActiveSourceId(v ?? 'all')} variant="pills">
            <Tabs.List>
              <Tabs.Tab value="all">Все источники</Tabs.Tab>
              {sources.map((source) => (
                <Tabs.Tab key={source.id} value={source.id}>
                  {source.title}
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>

          <Group gap="sm">
            <ActionIcon variant="light" color="gray" size="lg" radius="md" onClick={() => refetchAll()} aria-label="Обновить">
              {isLoading ? <Loader size={16} /> : <IconRefresh size={18} />}
            </ActionIcon>
            <Button variant="light" color="gray" leftSection={<IconSettings size={16} />} onClick={() => setManageOpen(true)}>
              Источники
            </Button>
          </Group>
        </Group>

        {failedSources.length > 0 && (
          <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Не удалось загрузить часть источников">
            <Stack gap={2}>
              {failedSources.map((s) => (
                <Text size="sm" key={s.source.id}>
                  • {s.source.title}: {s.errorMessage ?? 'неизвестная ошибка'}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        {sources.length === 0 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconNews size={24} />
              </ThemeIcon>
              <Text fw={600}>Источников новостей пока нет</Text>
              <Text size="sm" c="dimmed" ta="center" maw={360}>
                Добавьте ссылку на RSS-ленту медицинского издания — заголовки и краткие описания будут появляться здесь.
              </Text>
              <Button leftSection={<IconPlus size={18} />} onClick={() => setManageOpen(true)} mt="sm">
                Добавить источник
              </Button>
            </Stack>
          </Card>
        ) : isLoading && visibleItems.length === 0 ? (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} h={220} radius="md" />
            ))}
          </SimpleGrid>
        ) : visibleItems.length === 0 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="xl">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconNews size={24} />
              </ThemeIcon>
              <Text fw={600}>Пока нет новостей</Text>
              <Text size="sm" c="dimmed" ta="center" maw={360}>
                Лента этого источника пуста или ещё загружается.
              </Text>
            </Stack>
          </Card>
        ) : (
          <Stack gap="lg">
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
              {shownItems.map((item) => (
                <NewsCard key={item.id} item={item} onOpen={() => handleOpenItem(item)} />
              ))}
            </SimpleGrid>
            {hasMore && (
              <Center ref={sentinelRef} py="md">
                <Loader size={20} />
              </Center>
            )}
          </Stack>
        )}
      </Stack>

      <Modal opened={manageOpen} onClose={() => setManageOpen(false)} title="Источники новостей" radius="lg" size="lg" centered>
        <Stack gap="lg">
          <Stack gap="xs">
            {sources.length === 0 ? (
              <Text size="sm" c="dimmed">
                Пока не добавлено ни одного источника.
              </Text>
            ) : (
              sources.map((source) => (
                <Group key={source.id} justify="space-between" wrap="nowrap">
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={500} truncate>
                      {source.title}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {source.url}
                    </Text>
                  </div>
                  <ActionIcon variant="subtle" color="red" onClick={() => handleRemoveSource(source.id)} aria-label="Удалить источник">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))
            )}
          </Stack>

          <Stack gap="sm">
            <Text size="sm" fw={500}>
              Добавить источник
            </Text>
            <TextInput
              label="Ссылка на сайт или RSS-ленту"
              description="Можно вставить адрес сайта — RSS-лента найдётся автоматически"
              placeholder="https://example.com"
              value={newUrl}
              onChange={(e) => setNewUrl(e.currentTarget.value)}
              disabled={isAddingSource}
            />
            <TextInput
              label="Название (необязательно)"
              placeholder="Определится автоматически, если не указать"
              value={newTitle}
              onChange={(e) => setNewTitle(e.currentTarget.value)}
              disabled={isAddingSource}
            />
            <Group justify="flex-end">
              <Button
                leftSection={isAddingSource ? <Loader size={16} color="white" /> : <IconPlus size={16} />}
                onClick={handleAddSource}
                disabled={!newUrl.trim() || isAddingSource}
              >
                {isAddingSource ? 'Ищем ленту…' : 'Добавить'}
              </Button>
            </Group>
          </Stack>
        </Stack>
      </Modal>
    </Container>
  );
}
