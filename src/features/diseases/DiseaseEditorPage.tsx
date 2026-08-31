import { useMemo } from 'react';
import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { ReadingSheet } from '../../components/common/ReadingSheet';
import { RecordEditorPage } from '../../components/common/RecordEditorPage';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { DiseaseForm } from './DiseaseForm';
import type { DiseaseInput } from './types';
import { QUERY_KEY, useDisease, useDiseases } from './useDiseases';

/**
 * Редактор заболевания — отдельной страницей, а не окном.
 *
 * Описание правится полноценным редактором: текст про болезнь приносят готовым, разбитым на
 * разделы, и в окне ему тесно. У сокращений форма осталась окном — там четыре коротких поля.
 */
export function DiseaseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const confirmDelete = useDeleteWithConfirm();
  const { diseases, isLoading, createDisease, updateDisease, deleteDisease } = useDiseases();
  /*
   * Запись дочитывается целиком: в списке описания нет, а редактор правит именно его. Пока запрос
   * идёт, форма не рисуется — заполнить её пустым описанием значило бы предложить врачу сохранить
   * стёртый текст.
   */
  const { disease: full, isLoading: isLoadingFull } = useDisease(id);

  const editing = id ? (full ?? undefined) : undefined;
  const backTo = editing ? `/reference/diseases/${editing.id}` : '/reference';

  /** Разделы берутся из самих записей: отдельного списка у заболеваний нет — это специальности. */
  const sections = useMemo(
    () => [...new Set(diseases.map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')),
    [diseases],
  );

  const handleSubmit = async (input: DiseaseInput) => {
    if (editing) {
      await updateDisease(editing.id, input);
      notifications.show({ message: 'Заболевание сохранено', color: 'teal' });
      navigate(`/reference/diseases/${editing.id}`);
    } else {
      const created = await createDisease(input);
      notifications.show({ message: 'Заболевание добавлено в справочник', color: 'teal' });
      navigate(`/reference/diseases/${created.id}`);
    }
  };

  const handleDelete = () => {
    if (!editing) return;
    confirmDelete({
      what: 'заболевание',
      name: editing.name,
      notice: 'Заболевание удалено из справочника',
      queryKey: QUERY_KEY,
      id: editing.id,
      perform: () => deleteDisease(editing.id),
    });
    navigate('/reference');
  };

  return (
    <RecordEditorPage
      id={id}
      record={editing}
      isLoading={isLoading || (Boolean(id) && isLoadingFull)}
      notFound={{
        text: 'Такого заболевания в справочнике нет — возможно, запись удалили.',
        to: '/reference',
        label: 'К справочнику',
      }}
      back={
        <Button
          component={Link}
          to={backTo}
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          pl={8}
          style={{ alignSelf: 'flex-start' }}
        >
          Назад
        </Button>
      }
      title={editing ? 'Правка заболевания' : 'Новое заболевание'}
    >
      {/* Подложка: без неё подписи полей лежат прямо на обоях. */}
      <ReadingSheet>
        <DiseaseForm
          initial={editing}
          sections={sections}
          onSubmit={handleSubmit}
          onCancel={() => navigate(backTo)}
          onDelete={editing ? handleDelete : undefined}
        />
      </ReadingSheet>
    </RecordEditorPage>
  );
}
