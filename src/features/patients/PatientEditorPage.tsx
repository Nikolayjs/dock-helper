import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { PatientForm } from './PatientForm';
import type { PatientInput } from './usePatients';
import { QUERY_KEY as PATIENTS_KEY, usePatient, usePatients } from './usePatients';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { visitsWarning } from './deleteWarnings';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { RecordEditorPage } from '../../components/common/RecordEditorPage';

export function PatientEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isLoading, addPatient, updatePatient, deletePatient } = usePatients();
  const confirmDelete = useDeleteWithConfirm();
  // Правится запись целиком: у формы есть визиты, а в списке их больше нет.
  const editingPatient = usePatient(id).patient ?? undefined;

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
    <RecordEditorPage
      id={id}
      record={editingPatient}
      isLoading={isLoading}
      notFound={{ text: 'Пациент не найден', to: '/patients', label: 'К списку пациентов' }}
      back={
        <Button component={Link} to={backTo} variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8} style={{ alignSelf: 'flex-start' }}>
          Назад
        </Button>
      }
      title={editingPatient ? 'Редактирование пациента' : 'Новый пациент'}
    >
      {/* Подложка: без неё подписи полей и текст формы лежат прямо на обоях. */}
      <ReadingSheet>
        <PatientForm initialPatient={editingPatient} onSubmit={handleSubmit} onCancel={() => navigate(backTo)} onDelete={editingPatient ? handleDelete : undefined} />
      </ReadingSheet>
    </RecordEditorPage>
  );
}
