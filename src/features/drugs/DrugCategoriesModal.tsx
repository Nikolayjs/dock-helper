import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react';

import { useDrugCategories } from './useDrugCategories';

interface Props {
  opened: boolean;
  onClose: () => void;
  /** Сколько препаратов в каждом разделе — считается по самим карточкам. */
  counts: Map<string, number>;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : 'Не удалось выполнить действие';
}

/**
 * Разделы справочника: добавить, переименовать, удалить.
 *
 * Переименование здесь перекладывает и сами карточки — на бэкенде `drugs.category` хранит название,
 * а не ссылку. Удаление непустого раздела бэкенд отклоняет и говорит, сколько препаратов мешает:
 * молча обнулить раздел у полусотни карточек — слишком крупное последствие для одного нажатия.
 */
export function DrugCategoriesModal({ opened, onClose, counts }: Props) {
  const { categories, isLoading, addCategory, renameCategory, removeCategory } = useDrugCategories();
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await addCategory(name);
      setNewName('');
      notifications.show({ message: `Раздел «${name}» добавлен`, color: 'green' });
    } catch (error) {
      notifications.show({ message: errorText(error), color: 'red' });
    }
  };

  const handleRename = async (id: string) => {
    const name = draft.trim();
    if (!name) return;
    try {
      await renameCategory({ id, name });
      setEditingId(null);
      notifications.show({ message: 'Раздел переименован, карточки перенесены', color: 'green' });
    } catch (error) {
      notifications.show({ message: errorText(error), color: 'red' });
    }
  };

  const handleRemove = async (id: string, name: string) => {
    try {
      await removeCategory(id);
      notifications.show({ message: `Раздел «${name}» удалён`, color: 'green' });
    } catch (error) {
      notifications.show({ message: errorText(error), color: 'red', autoClose: 7000 });
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title="Разделы справочника" size="lg">
      <Stack gap="sm">
        <Alert variant="light" color="blue">
          Переименование раздела переносит в него все препараты, которые в нём числились. Удалить
          можно только пустой раздел.
        </Alert>

        <Group gap="xs" align="flex-end">
          <TextInput
            style={{ flex: 1 }}
            label="Новый раздел"
            placeholder="Например: Дерматология"
            value={newName}
            onChange={(e) => setNewName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleAdd();
              }
            }}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={() => void handleAdd()} disabled={!newName.trim()}>
            Добавить
          </Button>
        </Group>

        {isLoading ? (
          <Text c="dimmed" size="sm">
            Загрузка…
          </Text>
        ) : (
          <Stack gap={4}>
            {categories.map((category) => {
              const count = counts.get(category.name) ?? 0;
              const isEditing = editingId === category.id;
              return (
                <Group key={category.id} gap="xs" wrap="nowrap" py={4}>
                  {isEditing ? (
                    <>
                      <TextInput
                        style={{ flex: 1 }}
                        value={draft}
                        onChange={(e) => setDraft(e.currentTarget.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleRename(category.id);
                          }
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        autoFocus
                      />
                      <ActionIcon variant="light" color="green" onClick={() => void handleRename(category.id)} aria-label="Сохранить">
                        <IconCheck size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" onClick={() => setEditingId(null)} aria-label="Отмена">
                        <IconX size={16} />
                      </ActionIcon>
                    </>
                  ) : (
                    <>
                      <Text style={{ flex: 1 }}>{category.name}</Text>
                      <Badge variant="light" color={count > 0 ? 'blue' : 'gray'}>
                        {count}
                      </Badge>
                      <ActionIcon
                        variant="subtle"
                        onClick={() => {
                          setEditingId(category.id);
                          setDraft(category.name);
                        }}
                        aria-label={`Переименовать раздел ${category.name}`}
                      >
                        <IconPencil size={16} />
                      </ActionIcon>
                      <Tooltip label="Сначала перенесите препараты" disabled={count === 0}>
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          disabled={count > 0}
                          onClick={() => void handleRemove(category.id, category.name)}
                          aria-label={`Удалить раздел ${category.name}`}
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </>
                  )}
                </Group>
              );
            })}
          </Stack>
        )}
      </Stack>
    </Modal>
  );
}
