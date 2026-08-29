import { Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { EDITOR_MIN_HEIGHT } from '../../components/common/editorHeight';
import { NoteForm } from './NoteForm';
import type { NoteInput } from './useNotes';
import { QUERY_KEY as NOTES_KEY, useNotes } from './useNotes';
import { useDeleteWithConfirm } from '../deletion/deleteConfirmContext';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { RecordEditorPage } from '../../components/common/RecordEditorPage';

export function NoteEditorPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { notes, isLoading, addNote, updateNote, deleteNote } = useNotes();
  const confirmDelete = useDeleteWithConfirm();
  const editingNote = id ? notes.find((n) => n.id === id) : undefined;

  const from = (location.state as { from?: string } | null)?.from;
  const fallbackTo = from === '/calendar' ? '/calendar' : from === '/doctor' ? '/doctor' : from === '/dashboard' ? '/dashboard' : '/notes';
  const fallbackLabel =
    from === '/calendar' ? 'К календарю' : from === '/doctor' ? 'В профиль' : from === '/dashboard' ? 'К дашборду' : 'К списку заметок';

  const backTo = editingNote ? `/notes/${editingNote.id}` : fallbackTo;

  const handleSubmit = async (input: NoteInput) => {
    if (editingNote) {
      await updateNote(editingNote.id, input);
      notifications.show({ message: 'Изменения сохранены', color: 'teal' });
      navigate(`/notes/${editingNote.id}`, { state: { from } });
    } else {
      const created = await addNote(input);
      notifications.show({ message: 'Заметка создана', color: 'teal' });
      navigate(`/notes/${created.id}`, { state: { from } });
    }
  };

  const handleDelete = () => {
    if (!editingNote) return;
    confirmDelete({
      what: 'заметку',
      name: editingNote.title,
      notice: 'Заметка удалена',
      queryKey: NOTES_KEY,
      id: editingNote.id,
      perform: () => deleteNote(editingNote.id),
      onConfirmed: () => navigate(fallbackTo),
    });
  };

  return (
    <RecordEditorPage
      id={id}
      record={editingNote}
      isLoading={isLoading}
      notFound={{ text: 'Заметка не найдена', to: fallbackTo, label: fallbackLabel }}
      back={
        <Button
          component={Link}
          to={backTo}
          state={{ from }}
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          pl={8}
          style={{ alignSelf: 'flex-start' }}
        >
          Назад
        </Button>
      }
      title={editingNote ? 'Редактирование заметки' : 'Новая заметка'}
    >
      {/* Подложка: без неё подписи полей и текст формы лежат прямо на обоях. */}
      <ReadingSheet>
        <NoteForm
          initialNote={editingNote}
          initialDate={searchParams.get('date')}
          onSubmit={handleSubmit}
          onCancel={() => navigate(backTo, { state: { from } })}
          onDelete={editingNote ? handleDelete : undefined}
          contentMinHeight={EDITOR_MIN_HEIGHT}
        />
      </ReadingSheet>
    </RecordEditorPage>
  );
}
