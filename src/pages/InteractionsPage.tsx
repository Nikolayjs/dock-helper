import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Container,
  Group,
  Modal,
  Select,
  Skeleton,
  Stack,
  Text,
  TextInput,
  Textarea,
  TagsInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconInfoCircle, IconPills, IconPlus, IconSettings, IconTrash } from '@tabler/icons-react';

import { checkInteractions, getKnownDrugNames } from '../features/interactions/interactionEngine';
import { SEVERITY_COLOR, SEVERITY_LABELS, SEVERITY_OPTIONS } from '../features/interactions/types';
import type { InteractionSeverity } from '../features/interactions/types';
import { useDrugInteractions, type DrugInteractionInput } from '../features/interactions/useDrugInteractions';

const EMPTY_FORM: DrugInteractionInput = { drugA: '', drugB: '', severity: 'moderate', mechanism: '', recommendation: '' };

export function InteractionsPage() {
  const { interactions, isLoading, addInteraction, deleteInteraction } = useDrugInteractions();
  const [drugs, setDrugs] = useState<string[]>([]);
  const [manageOpen, setManageOpen] = useState(false);
  const [form, setForm] = useState<DrugInteractionInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const knownDrugNames = useMemo(() => getKnownDrugNames(interactions), [interactions]);
  const matches = useMemo(() => checkInteractions(drugs, interactions), [drugs, interactions]);

  const handleAddInteraction = async () => {
    if (!form.drugA.trim() || !form.drugB.trim() || !form.mechanism.trim() || !form.recommendation.trim()) return;
    setIsSaving(true);
    try {
      await addInteraction({
        drugA: form.drugA.trim(),
        drugB: form.drugB.trim(),
        severity: form.severity,
        mechanism: form.mechanism.trim(),
        recommendation: form.recommendation.trim(),
      });
      setForm(EMPTY_FORM);
      notifications.show({ message: 'Взаимодействие добавлено', color: 'teal' });
    } catch (error) {
      notifications.show({ message: error instanceof Error ? error.message : 'Не удалось сохранить', color: 'red' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deleteInteraction(id);
    notifications.show({ message: 'Взаимодействие удалено', color: 'gray' });
  };

  return (
    <Container size="lg" px={0}>
      <Stack gap="lg">
        <Alert variant="light" color="yellow" icon={<IconInfoCircle size={18} />} title="Не заменяет клиническое суждение">
          Проверка охватывает ограниченный набор хорошо известных взаимодействий, а не полную фармакологическую базу.
          Отсутствие предупреждения не гарантирует безопасность комбинации — при сомнениях сверяйтесь со справочником
          или инструкцией к препарату.
        </Alert>

        <Card withBorder padding="lg">
          <Group justify="space-between" mb="md" wrap="wrap">
            <Group gap={8}>
              <ThemeIcon variant="light" color="brand" size={30} radius="md">
                <IconPills size={16} />
              </ThemeIcon>
              <Title order={4}>Препараты пациента</Title>
            </Group>
            <Button variant="light" color="gray" size="xs" leftSection={<IconSettings size={14} />} onClick={() => setManageOpen(true)}>
              Управление списком
            </Button>
          </Group>

          {isLoading ? (
            <Skeleton h={36} radius="md" />
          ) : (
            <TagsInput
              placeholder="Начните вводить название препарата…"
              data={knownDrugNames}
              value={drugs}
              onChange={setDrugs}
              clearable
            />
          )}
        </Card>

        {drugs.length < 2 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="lg">
              <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                <IconPills size={24} />
              </ThemeIcon>
              <Text fw={600}>Добавьте минимум два препарата</Text>
              <Text size="sm" c="dimmed" ta="center" maw={420}>
                Взаимодействия проверяются попарно между всеми препаратами в списке выше.
              </Text>
            </Stack>
          </Card>
        ) : matches.length === 0 ? (
          <Alert variant="light" color="teal" icon={<IconInfoCircle size={18} />} title="Известных взаимодействий не найдено">
            Среди введённых препаратов нет пар из текущего списка проверки. Это не означает полную безопасность
            комбинации — см. предупреждение выше.
          </Alert>
        ) : (
          <Stack gap="sm">
            {matches.map(({ interaction, drugA, drugB }) => (
              <Alert
                key={interaction.id}
                variant="light"
                color={SEVERITY_COLOR[interaction.severity]}
                icon={<IconAlertTriangle size={18} />}
                title={
                  <Group gap={8} wrap="wrap">
                    <Text fw={600} span>
                      {drugA} + {drugB}
                    </Text>
                    <Badge size="sm" color={SEVERITY_COLOR[interaction.severity]} variant="filled">
                      {SEVERITY_LABELS[interaction.severity]}
                    </Badge>
                  </Group>
                }
              >
                <Stack gap={4}>
                  <Text size="sm">{interaction.mechanism}</Text>
                  <Text size="sm" fw={500}>
                    Рекомендация: {interaction.recommendation}
                  </Text>
                </Stack>
              </Alert>
            ))}
          </Stack>
        )}
      </Stack>

      <Modal opened={manageOpen} onClose={() => setManageOpen(false)} title="Список взаимодействий" radius="lg" size="lg" centered>
        <Stack gap="lg">
          <Stack gap="xs" mah={320} style={{ overflowY: 'auto' }}>
            {interactions.length === 0 ? (
              <Text size="sm" c="dimmed">
                Список пуст.
              </Text>
            ) : (
              interactions.map((interaction) => (
                <Group key={interaction.id} justify="space-between" wrap="nowrap" align="flex-start">
                  <div style={{ minWidth: 0 }}>
                    <Group gap={6} wrap="wrap">
                      <Text size="sm" fw={500}>
                        {interaction.drugA} + {interaction.drugB}
                      </Text>
                      <Badge size="xs" color={SEVERITY_COLOR[interaction.severity]} variant="light">
                        {SEVERITY_LABELS[interaction.severity]}
                      </Badge>
                    </Group>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {interaction.mechanism}
                    </Text>
                  </div>
                  <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(interaction.id)} aria-label="Удалить взаимодействие">
                    <IconTrash size={16} />
                  </ActionIcon>
                </Group>
              ))
            )}
          </Stack>

          <Stack gap="sm">
            <Text size="sm" fw={500}>
              Добавить взаимодействие
            </Text>
            <Group grow>
              <TextInput
                label="Препарат А"
                placeholder="Например: Варфарин"
                value={form.drugA}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setForm((prev) => ({ ...prev, drugA: value }));
                }}
                disabled={isSaving}
              />
              <TextInput
                label="Препарат Б"
                placeholder="Например: Ибупрофен"
                value={form.drugB}
                onChange={(e) => {
                  const value = e.currentTarget.value;
                  setForm((prev) => ({ ...prev, drugB: value }));
                }}
                disabled={isSaving}
              />
            </Group>
            <Select
              label="Серьёзность"
              data={SEVERITY_OPTIONS}
              value={form.severity}
              onChange={(v) => setForm((prev) => ({ ...prev, severity: (v as InteractionSeverity) ?? prev.severity }))}
              allowDeselect={false}
              disabled={isSaving}
            />
            <Textarea
              label="Механизм"
              placeholder="Почему это опасно"
              value={form.mechanism}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setForm((prev) => ({ ...prev, mechanism: value }));
              }}
              autosize
              minRows={2}
              disabled={isSaving}
            />
            <Textarea
              label="Рекомендация"
              placeholder="Что делать врачу"
              value={form.recommendation}
              onChange={(e) => {
                const value = e.currentTarget.value;
                setForm((prev) => ({ ...prev, recommendation: value }));
              }}
              autosize
              minRows={2}
              disabled={isSaving}
            />
            <Group justify="flex-end">
              <Button
                leftSection={<IconPlus size={16} />}
                onClick={handleAddInteraction}
                loading={isSaving}
                disabled={!form.drugA.trim() || !form.drugB.trim() || !form.mechanism.trim() || !form.recommendation.trim()}
              >
                Добавить
              </Button>
            </Group>
          </Stack>
        </Stack>
      </Modal>
    </Container>
  );
}
