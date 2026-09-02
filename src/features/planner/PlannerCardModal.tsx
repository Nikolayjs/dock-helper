import { useEffect, useState } from 'react';
import { Button, Group, Modal, Select, Stack, Text, Textarea, TextInput, UnstyledButton } from '@mantine/core';
import { IconCheck, IconTrash } from '@tabler/icons-react';

import { findMember, useWorkspaceMembers } from '../workspace/useWorkspaceMembers';
import { MemberSignature } from './MemberSignature';
import { useIsMobile } from '../../components/common/useIsMobile';
import { CARD_COLORS } from './types';
import type { PlannerCard, PlannerCardColor } from './types';

interface PlannerCardModalProps {
  opened: boolean;
  card: PlannerCard | null;
  onClose: () => void;
  onSave: (input: {
    title: string;
    description: string;
    color: PlannerCardColor | null;
    dueDate: string | null;
    assigneeId: string | null;
  }) => void;
  onDelete: (id: string) => void;
}

export function PlannerCardModal({ opened, card, onClose, onSave, onDelete }: PlannerCardModalProps) {
  const isMobile = useIsMobile();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<PlannerCardColor | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const { members } = useWorkspaceMembers();

  useEffect(() => {
    if (!opened) return;
    setTitle(card?.title ?? '');
    setDescription(card?.description ?? '');
    setColor(card?.color ?? null);
    setDueDate(card?.dueDate ?? '');
    setAssigneeId(card?.assigneeId ?? null);
  }, [opened, card]);

  const author = findMember(members, card?.authorId);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({ title: title.trim(), description: description.trim(), color, dueDate: dueDate || null, assigneeId });
  };

  return (
    <Modal opened={opened} onClose={onClose} title={card ? 'Карточка' : 'Новая карточка'} radius="lg" size="md" centered fullScreen={isMobile}>
      <Stack gap="md">
        <TextInput
          label="Название"
          placeholder="Например: Подготовить отчёт"
          value={title}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setTitle(value);
          }}
          data-autofocus
          required
        />
        <Textarea
          label="Описание"
          placeholder="Детали, заметки…"
          value={description}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setDescription(value);
          }}
          autosize
          minRows={3}
        />
        <TextInput
          type="date"
          label="Срок"
          value={dueDate}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setDueDate(value);
          }}
        />
        {/* Исполнителя выбирают, автор проставляется сам: подпись, которую можно выставить себе
            любую, ничего не значит. Пусто — нормальное состояние: карточку ещё никто не взял. */}
        <Select
          label="Взялся за работу"
          placeholder="Никто пока"
          data={members.map((member) => ({ value: member.id, label: member.name }))}
          value={assigneeId}
          onChange={setAssigneeId}
          clearable
          searchable={members.length > 6}
          nothingFoundMessage="Никого не найдено"
        />

        <div>
          <Text size="sm" fw={500} mb={6}>
            Метка
          </Text>
          <Group gap={8}>
            <UnstyledButton
              aria-label="Без метки"
              onClick={() => setColor(null)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 999,
                border: '2px dashed var(--mantine-color-gray-5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {color === null && <IconCheck size={14} />}
            </UnstyledButton>
            {CARD_COLORS.map((c) => (
              <UnstyledButton
                key={c}
                aria-label={c}
                onClick={() => setColor(c)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  backgroundColor: `var(--mantine-color-${c}-6)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  outline: color === c ? '2px solid var(--mantine-color-dark-9)' : 'none',
                  outlineOffset: 2,
                }}
              >
                {color === c && <IconCheck size={14} color="white" />}
              </UnstyledButton>
            ))}
          </Group>
        </div>

        {author && (
          <Group gap={6} wrap="nowrap">
            <MemberSignature member={author} kind="author" />
            <Text size="xs" c="dimmed">
              завёл карточку
            </Text>
          </Group>
        )}

        <Group justify="space-between" mt="sm">
          {card ? (
            <Button
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={16} />}
              onClick={() => onDelete(card.id)}
            >
              Удалить
            </Button>
          ) : (
            <span />
          )}
          <Group gap={8}>
            <Button variant="default" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={!title.trim()}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
