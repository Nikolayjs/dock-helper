import { useMemo, useState } from 'react';
import { Badge, Group, Modal, Stack, Text, TextInput, UnstyledButton } from '@mantine/core';
import { RichTextEditor } from '@mantine/tiptap';
import { IconLink, IconSearch } from '@tabler/icons-react';
import type { Editor } from '@tiptap/react';

import { useAbbreviations } from '../abbreviations/useAbbreviations';
import { useAllDocuments } from '../knowledgeBase/useDocuments';
import { useDiseases } from './useDiseases';

/**
 * Вставка вики-ссылки — выбором из справочника, а не набором вручную.
 *
 * Ссылка разрешается по **точному** названию, и это осознанно: нестрогое совпадение уже приводило к
 * тому, что «B03 Оспа» связывалась с рекомендацией про воспалительные заболевания кишечника. Но
 * заводские названия длинные — «Артериальная гипертензия: тактика ведения», — и набранное по памяти
 * `[[Артериальная гипертензия]]` не находит ничего. Проверено прогоном: ровно так и вышло.
 *
 * Поэтому название не печатают, а выбирают, и в текст уходит то, что точно разрешится. Выделенный
 * кусок при этом становится подписью (`[[Точное название|как в тексте]]`) — иначе ссылку нельзя
 * было бы просклонять, а несклоняемое название посреди фразы читается как машинная вставка.
 */
type Target = { id: string; kind: 'болезнь' | 'сокращение' | 'рекомендация' | 'статья'; title: string; note: string };

export function WikiLinkControl({ editor }: { editor: Editor | null }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { diseases } = useDiseases();
  const { abbreviations } = useAbbreviations();
  const { documents } = useAllDocuments();

  const targets = useMemo<Target[]>(
    () => [
      ...diseases.map((row) => ({ id: row.id, kind: 'болезнь' as const, title: row.name, note: row.summary })),
      ...abbreviations.map((row) => ({ id: row.id, kind: 'сокращение' as const, title: row.short, note: row.full })),
      ...documents.map((row) => ({
        id: row.id,
        kind: 'статья' as const,
        title: row.title,
        note: row.summary ?? '',
      })),
    ],
    [diseases, abbreviations, documents],
  );

  const found = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return targets.slice(0, 20);
    return targets.filter((row) => row.title.toLowerCase().includes(needle)).slice(0, 20);
  }, [targets, query]);

  const insert = (title: string) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const selected = editor.state.doc.textBetween(from, to).trim();
    // Выделенное становится подписью: так ссылку можно просклонять по фразе.
    const markup = selected && selected.toLowerCase() !== title.toLowerCase() ? `[[${title}|${selected}]]` : `[[${title}]]`;
    editor.chain().focus().insertContent(markup).run();
    setOpen(false);
    setQuery('');
  };

  return (
    <>
      <RichTextEditor.Control
        onClick={() => setOpen(true)}
        aria-label="Ссылка на справочник"
        title="Ссылка на справочник"
      >
        <IconLink size={16} />
      </RichTextEditor.Control>

      <Modal opened={open} onClose={() => setOpen(false)} title="Ссылка на справочник" size="lg">
        <Stack gap="sm">
          <TextInput
            data-autofocus
            placeholder="Название болезни, сокращение или рекомендация…"
            leftSection={<IconSearch size={16} />}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
          <Text size="xs" c="dimmed">
            Выделенный в тексте кусок станет подписью ссылки — название можно просклонять. Код МКБ-10
            пишется прямо в тексте: <code>[[I48.0]]</code>.
          </Text>

          <Stack gap={2}>
            {found.length === 0 ? (
              <Text size="sm" c="dimmed" py="sm">
                Ничего не нашлось. Ссылку можно поставить только на то, что в справочнике уже есть, —
                иначе она будет обещать связь, которой нет.
              </Text>
            ) : (
              found.map((row) => (
                <UnstyledButton key={`${row.kind}-${row.id}`} onClick={() => insert(row.title)} p={6}>
                  <Group gap="xs" wrap="nowrap" align="baseline">
                    <Text size="sm" fw={600}>
                      {row.title}
                    </Text>
                    <Badge size="xs" variant="light" color="gray">
                      {row.kind}
                    </Badge>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {row.note}
                    </Text>
                  </Group>
                </UnstyledButton>
              ))
            )}
          </Stack>
        </Stack>
      </Modal>
    </>
  );
}
