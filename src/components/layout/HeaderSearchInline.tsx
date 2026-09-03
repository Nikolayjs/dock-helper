import { useState } from 'react';
import { ActionIcon, Loader, Popover, ScrollArea, TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';

import { HeaderSearchResults } from './HeaderSearchResults';
import { useHeaderSearch } from './useHeaderSearch';

/**
 * Поиск на широком экране: поле в шапке и выпадающий список под ним.
 *
 * Поведение то же, что было до разделения на оболочки, — поле видно всегда, данные нужны сразу при
 * вводе, поэтому источники здесь монтируются вместе с шапкой и это осознанно: на широком экране
 * поле и есть приглашение искать.
 */
export function HeaderSearchInline() {
  const { query, setQuery, trimmedQuery, isSearching, groupedResults, totalResults, select } = useHeaderSearch();
  const [focused, setFocused] = useState(false);
  const opened = focused && trimmedQuery.length > 0;

  return (
    <Popover opened={opened} width={340} position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <TextInput
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') event.currentTarget.blur();
          }}
          placeholder="Поиск пациента, калькулятора…"
          radius="md"
          aria-label="Поиск по приложению"
          leftSection={<IconSearch size={16} />}
          rightSection={
            isSearching ? (
              <Loader size={14} />
            ) : query ? (
              <ActionIcon
                aria-label="Очистить поиск"
                variant="subtle"
                color="gray"
                size="sm"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setQuery('')}
              >
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          // Поле сужается на промежуточной ширине окна: именно оно делает правую сторону шапки
          // шире левой, а от разницы съезжает заголовок между ними.
          w={{ base: 160, sm: 200, lg: 280 }}
        />
      </Popover.Target>
      <Popover.Dropdown p="xs" onMouseDown={(event) => event.preventDefault()}>
        <ScrollArea.Autosize mah={360} type="auto">
          <HeaderSearchResults
            groups={groupedResults}
            total={totalResults}
            isSearching={isSearching}
            query={trimmedQuery}
            onSelect={(path) => {
              setFocused(false);
              select(path);
            }}
          />
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}
