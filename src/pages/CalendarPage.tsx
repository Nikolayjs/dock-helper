import { useState } from 'react';
import { Container, Tabs } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { NotesCalendarView } from '../features/notes/NotesCalendarView';
import type { Note } from '../features/notes/types';
import { useNotes } from '../features/notes/useNotes';
import { RemindersCalendarView } from '../features/reminders/RemindersCalendarView';
import { useReminders } from '../features/reminders/useReminders';

type CalendarTab = 'notes' | 'reminders';

export function CalendarPage() {
  const { notes, deleteNote, toggleTodoItem } = useNotes();
  const { reminders, addReminder, updateReminder, deleteReminder } = useReminders();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => dayjs().format('YYYY-MM-DD'));
  const [tab, setTab] = useState<CalendarTab>('notes');

  const handleDeleteNote = (note: Note) => {
    deleteNote(note.id);
    notifications.show({ message: 'Заметка удалена', color: 'gray' });
  };

  const handleDeleteReminder = (id: string) => {
    deleteReminder(id);
    notifications.show({ message: 'Напоминание удалено', color: 'gray' });
  };

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
