import { useMemo, useState } from 'react';
import { Button, Card, Group, SimpleGrid, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconAffiliate, IconPlus, IconSearch } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { DocumentCard } from './DocumentCard';
import type { KnowledgeDocument } from './types';

interface KnowledgeGridProps {
  documents: KnowledgeDocument[];
  icon: typeof IconPlus;
  addLabel?: string;
  emptyTitle: string;
  emptyText: string;
  searchPlaceholder: string;
  onAdd?: () => void;
  onOpen: (doc: KnowledgeDocument) => void;
  onEdit: (doc: KnowledgeDocument) => void;
  onDelete: (doc: KnowledgeDocument) => void;
  onTagClick?: (tag: string) => void;
  showGraphLink?: boolean;
}

export function KnowledgeGrid({
  documents,
  icon: Icon,
  addLabel,
  emptyTitle,
  emptyText,
  searchPlaceholder,
  onAdd,
  onOpen,
  onEdit,
  onDelete,
  onTagClick,
  showGraphLink = true,
}: KnowledgeGridProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return documents;
    return documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(query) ||
        doc.summary.toLowerCase().includes(query) ||
        doc.tags.some((tag) => tag.toLowerCase().includes(query)),
    );
  }, [documents, search]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [filtered]);

  return (
    <Stack gap="lg">
      <Group justify="space-between" wrap="wrap" gap="md">
        <TextInput
          placeholder={searchPlaceholder}
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={280}
        />
        <Group gap="sm">
          {showGraphLink && (
            <Button component={Link} to="/knowledge/graph" variant="light" color="gray" leftSection={<IconAffiliate size={18} />}>
              Граф связей
            </Button>
          )}
          {onAdd && (
            <Button leftSection={<IconPlus size={18} />} onClick={onAdd}>
              {addLabel}
            </Button>
          )}
        </Group>
      </Group>

      {sorted.length === 0 ? (
        <Card withBorder padding="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <Icon size={24} />
            </ThemeIcon>
            <Text fw={600}>{emptyTitle}</Text>
            <Text size="sm" c="dimmed" ta="center" maw={360}>
              {emptyText}
            </Text>
          </Stack>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {sorted.map((doc) => (
            <DocumentCard
              key={doc.id}
              doc={doc}
              icon={Icon}
              onOpen={() => onOpen(doc)}
              onEdit={() => onEdit(doc)}
              onDelete={() => onDelete(doc)}
              onTagClick={onTagClick}
            />
          ))}
        </SimpleGrid>
      )}
    </Stack>
  );
}
