import { Button, Container, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DispensaryForm } from './DispensaryForm';
import { usePatients } from './usePatients';
import { useDispensary } from './useDispensary';
import type { DispensaryRecordInput } from './useDispensary';
import { ReadingSheet } from '../../components/common/ReadingSheet';

export function DispensaryEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { patients } = usePatients();
  const { records, addRecord, updateRecord } = useDispensary();
  const editingRecord = id ? records.find((r) => r.id === id) : undefined;

  if (id && !editingRecord) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Карта не найдена</Text>
          <Button component={Link} to="/patients" mt="md">
            К списку пациентов
          </Button>
        </Stack>
      </Container>
    );
  }

  const backTo = editingRecord ? `/patients/dispensary/${editingRecord.id}` : '/patients';

  const handleSubmit = async (input: DispensaryRecordInput) => {
    if (editingRecord) {
      await updateRecord(editingRecord.id, input);
      notifications.show({ message: 'Изменения сохранены', color: 'teal' });
      navigate(`/patients/dispensary/${editingRecord.id}`);
    } else {
      const created = await addRecord(input);
      notifications.show({ message: 'Пациент поставлен на диспансерный учёт', color: 'teal' });
      navigate(`/patients/dispensary/${created.id}`);
    }
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Button component={Link} to={backTo} variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8} style={{ alignSelf: 'flex-start' }}>
          Назад
        </Button>
        <Title order={3}>{editingRecord ? 'Редактирование карты учёта' : 'Постановка на диспансерный учёт'}</Title>
        {/* Подложка: без неё подписи полей и текст формы лежат прямо на обоях. */}
        <ReadingSheet>
          <DispensaryForm
            patients={patients}
            initialRecord={editingRecord}
            defaultPatientId={searchParams.get('patientId') ?? undefined}
            onSubmit={handleSubmit}
            onCancel={() => navigate(backTo)}
          />
        </ReadingSheet>
      </Stack>
    </Container>
  );
}
