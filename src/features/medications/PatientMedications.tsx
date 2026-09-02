import { useMemo, useState } from 'react';
import { ActionIcon, Button, Card, Group, Stack, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconPlus, IconTrash, IconVaccine } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { PageSection } from '../../components/common/PageSection';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { interactionsHref } from './interactionsLink';
import { MedicationForm } from './MedicationForm';
import type { MedicationDraft } from './MedicationForm';
import type { PatientMedication } from './types';
import { QUERY_KEY, usePatientMedications } from './usePatientMedications';

/**
 * Постоянная терапия пациента.
 *
 * Список нужен не сам по себе: он существует ради кнопки рядом с ним. Назначая новое, врач должен
 * узнать о столкновении **до** того, как выпишет рецепт, а не после.
 */
export function PatientMedications({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const { medications, addMedication, updateMedication, deleteMedication } = usePatientMedications();
  const confirmDelete = useDeleteWithConfirm();
  const [editor, setEditor] = useState<PatientMedication | 'new' | null>(null);

  const own = useMemo(
    () => medications.filter((medication) => medication.patientId === patientId),
    [medications, patientId],
  );
  const patientPath = `/patients/${patientId}`;

  const handleSave = async (draft: MedicationDraft) => {
    if (editor && editor !== 'new') {
      await updateMedication(editor.id, { ...draft, patientId });
      notifications.show({ message: 'Назначение обновлено', color: 'teal' });
    } else {
      await addMedication({ ...draft, patientId });
      notifications.show({ message: 'Препарат добавлен в терапию', color: 'teal' });
    }
    setEditor(null);
  };

  const handleDelete = (medication: PatientMedication) =>
    confirmDelete({
      what: 'препарат',
      name: medication.name,
      notice: 'Препарат убран из терапии',
      queryKey: QUERY_KEY,
      id: medication.id,
      perform: () => deleteMedication(medication.id),
      onConfirmed: () => {
        if (editor && editor !== 'new' && editor.id === medication.id) setEditor(null);
      },
    });

  return (
    <PageSection
      title="Постоянная терапия"
      action={
        <Group gap="xs" wrap="wrap">
          {/* Кнопка есть уже при одном препарате: обычный приём — это «пациент пьёт вот это, я
              собираюсь добавить вот то», и второй препарат дописывается прямо на странице проверки. */}
          <Button
            size="xs"
            variant="light"
            leftSection={<IconVaccine size={14} />}
            disabled={own.length === 0}
            onClick={() =>
              navigate(interactionsHref(own.map((medication) => medication.name)), { state: { from: patientPath } })
            }
          >
            Проверить взаимодействия
          </Button>
          {editor === null && (
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setEditor('new')}>
              Добавить препарат
            </Button>
          )}
        </Group>
      }
    >
      <Stack gap="sm">
        {editor === 'new' && <MedicationForm onSubmit={handleSave} onCancel={() => setEditor(null)} />}

        {own.length === 0 && editor !== 'new' ? (
          <Text size="sm" c="dimmed">
            Постоянная терапия не записана. Запишите — и проверку взаимодействий можно будет открыть
            одним нажатием, вместе с тем, что назначаете сейчас.
          </Text>
        ) : (
          own.map((medication) =>
            editor !== 'new' && editor?.id === medication.id ? (
              <MedicationForm
                key={medication.id}
                initialMedication={medication}
                onSubmit={handleSave}
                onCancel={() => setEditor(null)}
              />
            ) : (
              <Card key={medication.id} withBorder padding="md" radius="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={2} style={{ minWidth: 0 }}>
                    <Group gap={8} wrap="wrap">
                      <Text fw={600} size="sm">
                        {medication.name}
                      </Text>
                      {medication.dose && (
                        <Text size="sm" c="dimmed">
                          {medication.dose}
                        </Text>
                      )}
                    </Group>
                    {medication.note && (
                      <Text size="sm" c="dimmed">
                        {medication.note}
                      </Text>
                    )}
                  </Stack>
                  <Group gap={2} wrap="nowrap">
                    <Tooltip label="Изменить">
                      <ActionIcon aria-label="Изменить" variant="subtle" color="gray" size="sm" onClick={() => setEditor(medication)}>
                        <IconEdit size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Убрать из терапии">
                      <ActionIcon aria-label="Убрать из терапии" variant="subtle" color="red" size="sm" onClick={() => handleDelete(medication)}>
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
              </Card>
            ),
          )
        )}
      </Stack>
    </PageSection>
  );
}
