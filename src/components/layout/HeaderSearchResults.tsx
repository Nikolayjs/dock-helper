import { Group, Loader, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';

import type { SearchGroup } from './useHeaderSearch';

/**
 * Список находок — один на обе оболочки поиска.
 *
 * Разметка у поля с выпадающим списком и у полноэкранного окна разная, а строки в них одни и те
 * же: группа, значок, название и подпись. Две копии этого разошлись бы ровно так же, как разошлись
 * бы два набора источников.
 */
interface HeaderSearchResultsProps {
  groups: SearchGroup[];
  total: number;
  isSearching: boolean;
  query: string;
  onSelect: (path: string) => void;
}

export function HeaderSearchResults({ groups, total, isSearching, query, onSelect }: HeaderSearchResultsProps) {
  if (isSearching) {
    return (
      <Group justify="center" py="md">
        <Loader size="sm" />
      </Group>
    );
  }

  if (total === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        Ничего не найдено по запросу «{query}»
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {groups.map(({ group, items }) => (
        <Stack key={group} gap={2}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase" px={6}>
            {group}
          </Text>
          {items.map((item) => (
            <UnstyledButton
              key={`${item.group}-${item.id}`}
              onClick={() => onSelect(item.path)}
              p={6}
              style={{ borderRadius: 8 }}
            >
              <Group gap={10} wrap="nowrap">
                <ThemeIcon variant="light" color="brand" size={30} radius="md">
                  <item.icon size={16} stroke={1.8} />
                </ThemeIcon>
                <div style={{ overflow: 'hidden' }}>
                  <Text size="sm" fw={500} truncate>
                    {item.title}
                  </Text>
                  {item.description && (
                    <Text size="xs" c="dimmed" truncate>
                      {item.description}
                    </Text>
                  )}
                </div>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      ))}
    </Stack>
  );
}
