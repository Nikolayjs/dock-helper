import { useState } from 'react';
import { ActionIcon, Loader, Modal, ScrollArea, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch, IconX } from '@tabler/icons-react';

import { HeaderSearchResults } from './HeaderSearchResults';
import { useHeaderSearch } from './useHeaderSearch';

/**
 * Поиск на телефоне: иконка в шапке и полноэкранное окно.
 *
 * Поле в шапке на 320–390 px не помещается вместе с бургером, заголовком раздела и колокольчиком —
 * а с фиксированной шириной оно и было тем, что выталкивало шапку за край экрана.
 *
 * **Содержимое монтируется только при открытом окне, и это не оптимизация.** Хук поиска вызывает
 * `usePatients()`, `useDocuments()`, `useNotes()`, `useCalculators()` — то есть запросы; шапка стоит
 * на каждой странице, и без этого разделения каждый заход в любой раздел с телефона тянул бы весь
 * список пациентов вместе с визитами. Пока врач не нажал лупу, запросов быть не должно.
 */
export function HeaderSearchModal() {
  const [opened, setOpened] = useState(false);

  return (
    <>
      <ActionIcon
        variant="light"
        color="gray"
        size="lg"
        radius="md"
        onClick={() => setOpened(true)}
        aria-label="Поиск по приложению"
      >
        <IconSearch size={18} />
      </ActionIcon>

      <Modal
        opened={opened}
        onClose={() => setOpened(false)}
        fullScreen
        title="Поиск"
        radius={0}
        padding="md"
        // Тело окна — вся оставшаяся высота: список находок на экране 360 px не должен упираться
        // в потолок в 360 px, отдавая половину экрана пустоте.
        styles={{ content: { display: 'flex', flexDirection: 'column' }, body: { flex: 1, minHeight: 0, display: 'flex' } }}
      >
        {/* Отдельный компонент, и это же сбрасывает запрос при закрытии: состояние живёт внутри
            него и умирает вместе с ним — иначе повторное открытие показывало бы прошлые находки. */}
        {opened && <HeaderSearchModalContent onClose={() => setOpened(false)} />}
      </Modal>
    </>
  );
}

function HeaderSearchModalContent({ onClose }: { onClose: () => void }) {
  const { query, setQuery, trimmedQuery, isSearching, groupedResults, totalResults, select } = useHeaderSearch();

  return (
    <Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
      <TextInput
        // Открыли поиск — значит собираются печатать: без автофокуса это лишнее касание.
        data-autofocus
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={(event) => {
          // Escape закрывает окно целиком, а не просто снимает фокус с поля: закрытого поля на
          // полном экране не видно, и «ничего не произошло» — единственное, что заметит врач.
          if (event.key === 'Escape') onClose();
        }}
        placeholder="Поиск пациента, калькулятора…"
        radius="md"
        size="md"
        aria-label="Поиск по приложению"
        leftSection={<IconSearch size={18} />}
        rightSection={
          isSearching ? (
            <Loader size={16} />
          ) : query ? (
            <ActionIcon aria-label="Очистить поиск" variant="subtle" color="gray" size="md" onClick={() => setQuery('')}>
              <IconX size={16} />
            </ActionIcon>
          ) : null
        }
      />

      <ScrollArea style={{ flex: 1, minHeight: 0 }} type="auto">
        {trimmedQuery.length === 0 ? (
          <Text size="sm" c="dimmed" py="md">
            Пациенты, препараты, коды МКБ-10, калькуляторы, заметки, статьи и рекомендации — всё
            сразу. Начните вводить название или фамилию.
          </Text>
        ) : (
        <HeaderSearchResults
          groups={groupedResults}
          total={totalResults}
          isSearching={isSearching}
          query={trimmedQuery}
          onSelect={(path) => {
            onClose();
            select(path);
          }}
        />
        )}
      </ScrollArea>
    </Stack>
  );
}
