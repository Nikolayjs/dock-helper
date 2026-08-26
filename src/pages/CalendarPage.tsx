import { useState } from 'react';
import { Container, Tabs } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { NotesCalendarView } from '../features/notes/NotesCalendarView';
import type { Note } from '../features/notes/types';
import { QUERY_KEY as NOTES_KEY, useNotes } from '../features/notes/useNotes';
import { RemindersCalendarView } from '../features/reminders/RemindersCalendarView';
import { QUERY_KEY as REMINDERS_KEY, useReminders } from '../features/reminders/useReminders';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';

type CalendarTab = 'notes' | 'reminders';

export function CalendarPage() {
  const { notes, deleteNote, toggleTodoItem } = useNotes();
  const { reminders, addReminder, updateReminder, deleteReminder } = useReminders();
  const confirmDelete = useDeleteWithConfirm();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [tab, setTab] = useState<CalendarTab>('notes');

  const handleDeleteNote = (note: Note) =>
    confirmDelete({
      what: 'заметку',
      name: note.title,
      notice: 'Заметка удалена',
      queryKey: NOTES_KEY,
      id: note.id,
      perform: () => deleteNote(note.id),
    });

  const handleDeleteReminder = (id: string) =>
    confirmDelete({
      what: 'напоминание',
      name: reminders.find((reminder) => reminder.id === id)?.title,
      notice: 'Напоминание удалено',
      queryKey: REMINDERS_KEY,
      id,
      perform: () => deleteReminder(id),
    });

  return (
    <Container size="xl" px={0}>
      <Tabs value={tab} onChange={(v) => setTab((v as CalendarTab) ?? 'notes')} variant="pills" mb="md">
        <Tabs.List>
          <Tabs.Tab value="notes">Заметки</Tabs.Tab>
          <Tabs.Tab value="reminders">Напоминания</Tabs.Tab>
        </Tabs.List>
      </Tabs>

      {tab === 'notes' ? (
        <NotesCalendarView
          notes={notes}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onAddForSelectedDate={() => navigate(`/notes/new?date=${selectedDate}`, { state: { from: '/calendar' } })}
          onOpenNote={(note) => navigate(`/notes/${note.id}`, { state: { from: '/calendar' } })}
          onEditNote={(note) => navigate(`/notes/${note.id}/edit`, { state: { from: '/calendar' } })}
          onDeleteNote={handleDeleteNote}
          onToggleItem={toggleTodoItem}
        />
      ) : (
        <RemindersCalendarView
          reminders={reminders}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onCreate={(input) => {
            void addReminder(input);
            notifications.show({ message: 'Напоминание добавлено', color: 'brand' });
          }}
          onUpdate={(id, input) => {
            void updateReminder(id, input);
            notifications.show({ message: 'Напоминание обновлено', color: 'brand' });
          }}
          onDelete={handleDeleteReminder}
        />
      )}
    </Container>
  );
}
