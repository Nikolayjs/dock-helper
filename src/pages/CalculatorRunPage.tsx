import { useState } from 'react';
import { Badge, Button, Card, Container, Group, Loader, Modal, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft, IconEdit, IconStethoscope } from '@tabler/icons-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';

import { CalculatorForm } from '../features/calculators/CalculatorForm';
import { createDraftPreset, PresetEditorRow, type DraftPreset } from '../features/calculators/builder/PresetEditorRow';
import { useCalculators } from '../features/calculators/useCalculators';

export function CalculatorRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { calculators, isLoading, updateCalculator } = useCalculators();
  const [draftPreset, setDraftPreset] = useState<DraftPreset | null>(null);

  const definition = calculators.find((calc) => calc.id === id);

  if (!definition) {
    if (isLoading) {
      return (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      );
    }
    return <Navigate to="/calculators" replace />;
  }

  const handleSavePreset = async () => {
    if (!draftPreset || !draftPreset.label.trim()) return;
    const { uid: _uid, ...preset } = draftPreset;
    await updateCalculator({ ...definition, presets: [...(definition.presets ?? []), preset] });
    notifications.show({ message: 'Пресет добавлен', color: 'teal' });
    setDraftPreset(null);
  };

  return (
    <Container size="md" px={0}>
      <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/calculators')} mb="lg">
        К списку калькуляторов
      </Button>

      <Card withBorder padding="xl">
        <Group justify="space-between" align="flex-start" mb="lg">
          <Group gap="md" align="flex-start">
            <ThemeIcon size={52} radius="md" variant="light" color="brand">
              <IconStethoscope size={26} />
            </ThemeIcon>
            <div>
              <Group gap={8} mb={4}>
                <Title order={3}>{definition.title}</Title>
                <Badge variant="light" color="brand">
                  {definition.category}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                {definition.description}
              </Text>
            </div>
          </Group>
          <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/calculators/${definition.id}/edit`)}>
            Изменить
          </Button>
        </Group>

        <Stack gap="lg">
          <CalculatorForm definition={definition} onAddPreset={() => setDraftPreset(createDraftPreset())} />
        </Stack>
      </Card>

      <Modal opened={draftPreset !== null} onClose={() => setDraftPreset(null)} title="Новый пресет" radius="lg" size="lg" centered>
        {draftPreset && (
          <Stack gap="md">
            <PresetEditorRow
              preset={draftPreset}
              fields={definition.fields.map((field) => ({ ...field, uid: field.key }))}
              onChange={setDraftPreset}
              onRemove={() => setDraftPreset(null)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDraftPreset(null)}>
                Отмена
              </Button>
              <Button onClick={handleSavePreset} disabled={!draftPreset.label.trim()}>
                Сохранить пресет
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
