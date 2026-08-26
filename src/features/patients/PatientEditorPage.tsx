import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PatientForm } from './PatientForm';
import type { PatientInput } from './usePatients';
import { QUERY_KEY as PATIENTS_KEY, usePatients } from './usePatients';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { visitsWarning } from './deleteWarnings';

export function PatientEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { patients, addPatient, updatePatient, deletePatient } = usePatients();
  const confirmDelete = useDeleteWithConfirm();
  const editingPatient = id ? patients.find((p) => p.id === id) : undefined;

  if (id && !editingPatient) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Пациент не найден</Text>
          <Button component={Link} to="/patients" mt="md">
            К списку пациентов
          </Button>
        </Stack>
      </Container>
    );
  }

  const backTo = editingPatient ? `/patients/${editingPatient.id}` : '/patients';

  const handleSubmit = async (input: PatientInput) => {
    if (editingPatient) {
      await updatePatient(editingPatient.id, input);
      notifications.show({ message: 'Изменения сохранены', color: 'teal' });
      navigate(`/patients/${editingPatient.id}`);
    } else {
      const created = await addPatient(input);
      notifications.show({ message: 'Пациент добавлен', color: 'teal' });
      navigate(`/patients/${created.id}`);
    }
  };

  const handleDelete = () => {
    if (!editingPatient) return;
    confirmDelete({
      what: 'пациента',
      name: editingPatient.fullName,
      alsoRemoves: visitsWarning(editingPatient.visits.length),
      notice: 'Пациент удалён',
      queryKey: PATIENTS_KEY,
      id: editingPatient.id,
      perform: () => deletePatient(editingPatient.id),
      onConfirmed: () => navigate('/patients'),
    });
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Button component={Link} to={backTo} variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8} style={{ alignSelf: 'flex-start' }}>
          Назад
        </Button>
        <Title order={3}>{editingPatient ? 'Редактирование пациента' : 'Новый пациент'}</Title>
        <PatientForm initialPatient={editingPatient} onSubmit={handleSubmit} onCancel={() => navigate(backTo)} onDelete={editingPatient ? handleDelete : undefined} />
      </Stack>
    </Container>
  );
}
