import { useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Container,
  Group,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { IconEye, IconInfoCircle, IconLayoutDistributeHorizontal, IconLayoutGrid, IconRotate } from '@tabler/icons-react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import gridClasses from '../features/dashboard/DashboardGrid.module.css';
import { SortableWidget } from '../features/dashboard/SortableWidget';
import { useDashboardLayout } from '../features/dashboard/useDashboardLayout';
import type { DashboardContext } from '../features/dashboard/dashboardContext';
import { rankTemplates, readUsage } from '../features/dashboard/documentUsage';
import {
  countUndated,
  getAgeDistribution,
  getContinueReading,
  getDispensaryQueue,
  getLapsedPatients,
  getMonthlyVisitCount,
  getSexDistribution,
  getTopDiagnoses,
  getVisitLoad,
  type LoadPeriod,
} from '../features/dashboard/practice';
import {
  getRecentPatients,
  getReferralBreakdown,
  getReferralEntries,
  getReferralPeriodRange,
  getTodayNotes,
  getUpcomingReminders,
  type ReferralPeriod,
} from '../features/dashboard/selectors';
import { QUERY_KEY as NOTES_KEY, useNotes } from '../features/notes/useNotes';
import type { Note } from '../features/notes/types';
import { useDocumentTemplates } from '../features/patients/documents/useDocumentTemplates';
import { useLibrary } from '../features/library/useLibrary';
import { useDispensary } from '../features/patients/useDispensary';
import { usePatients } from '../features/patients/usePatients';
import { usePlanner } from '../features/planner/usePlanner';
import { getUpcomingReminders as getUpcomingCalendarReminders } from '../features/reminders/selectors';
import { useReminders } from '../features/reminders/useReminders';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { HEADER_HEIGHT } from '../layouts/shellMetrics';

/** Через столько месяцев без визита пациент считается выпавшим из наблюдения. */
const LAPSED_MONTHS = 12;

export function DashboardPage() {
  const navigate = useNavigate();
  const { patients } = usePatients();
  const { records } = useDispensary();
  const { notes, deleteNote, toggleTodoItem } = useNotes();
  const { cards } = usePlanner();
  const { reminders } = useReminders();
  const { books } = useLibrary();
  const { templates } = useDocumentTemplates();
  const confirmDelete = useDeleteWithConfirm();

  const [editing, setEditing] = useState(false);
  const [loadPeriod, setLoadPeriod] = useState<LoadPeriod>('year');
  const [referralPeriod, setReferralPeriod] = useState<ReferralPeriod>('month');

  const layout = useDashboardLayout();
  // Ниже `md` каждая карточка занимает всю ширину, и менять её нечем — ручка там только мешала бы.
  const isWide = useMediaQuery('(min-width: 62em)') ?? false;

  const sensors = useSensors(
    // The same 4px threshold the sidebar and the planner use, so a click stays a click.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const queue = useMemo(() => getDispensaryQueue(records, patients), [records, patients]);
  const monthlyVisits = useMemo(() => getMonthlyVisitCount(patients), [patients]);
  const lapsed = useMemo(() => getLapsedPatients(patients, LAPSED_MONTHS), [patients]);
  const visitLoad = useMemo(() => getVisitLoad(patients, loadPeriod), [patients, loadPeriod]);
  const ageDistribution = useMemo(() => getAgeDistribution(patients), [patients]);
  const sexDistribution = useMemo(() => getSexDistribution(patients), [patients]);
  const undatedCount = useMemo(() => countUndated(patients), [patients]);
  const topDiagnoses = useMemo(() => getTopDiagnoses(patients), [patients]);
  const reading = useMemo(() => getContinueReading(books), [books]);

  // Счётчик печати живёт в localStorage и меняется на другой странице, так что перечитывать его
  // на каждый рендер незачем — возвращение на дашборд пересоздаёт компонент вместе с ним.
  const templatesById = useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates]);
  const frequentTemplates = useMemo(
    () => rankTemplates(readUsage(), new Set(templatesById.keys())),
    [templatesById],
  );

  const referralRange = useMemo(() => getReferralPeriodRange(referralPeriod), [referralPeriod]);
  const referralBreakdown = useMemo(
    () => getReferralBreakdown(patients, referralRange.start, referralRange.end),
    [patients, referralRange],
  );
  const referralEntries = useMemo(
    () => getReferralEntries(patients, referralRange.start, referralRange.end, 8),
    [patients, referralRange],
  );

  const dueCards = useMemo(() => {
    const horizon = dayjs().add(7, 'day');
    return cards
      .filter((card) => card.dueDate && !dayjs(card.dueDate).isAfter(horizon, 'day'))
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''));
  }, [cards]);

  const removeNote = (note: Note) =>
    confirmDelete({
      what: 'заметку',
      name: note.title,
      notice: 'Заметка удалена',
      queryKey: NOTES_KEY,
      id: note.id,
      perform: () => deleteNote(note.id),
    });

  const ctx: DashboardContext = {
    queue,
    monthlyVisits,
    lapsed,
    lapsedMonths: LAPSED_MONTHS,
    visitLoad,
    loadPeriod,
    setLoadPeriod,
    ageDistribution,
    sexDistribution,
    undatedCount,
    topDiagnoses,
    reading,
    frequentTemplates,
    templatesById,
    allNotes: notes,
    allReminders: reminders,
    widgetSettings: { get: layout.settingOf, set: layout.setSetting },
    referrals: {
      period: referralPeriod,
      setPeriod: setReferralPeriod,
      range: referralRange,
      breakdown: referralBreakdown,
      entries: referralEntries,
      total: referralBreakdown.reduce((sum, item) => sum + item.value, 0),
    },
    todayNotes: getTodayNotes(notes),
    notesActions: {
      open: (id) => navigate(`/notes/${id}`, { state: { from: '/dashboard' } }),
      edit: (id) => navigate(`/notes/${id}/edit`, { state: { from: '/dashboard' } }),
      remove: removeNote,
      toggleItem: toggleTodoItem,
    },
    dueCards,
    patientReminders: getUpcomingReminders(patients, 6),
    calendarReminders: getUpcomingCalendarReminders(reminders, 7),
    recentPatients: getRecentPatients(patients, 5),
  };

  // Показывается ровно то, что включено. Раньше пустая карточка молча пропадала, и получалось,
  // что в настройке она отмечена видимой, а на дашборде её нет. С конструктором решает врач:
  // карточка рисует своё пустое состояние, а метка «пусто» в режиме настройки подсказывает,
  // что её можно выключить.
  const shown = layout.visible;
  const hiddenWidgets = layout.all.filter((widget) => layout.isHidden(widget.id));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) layout.reorder(String(active.id), String(over.id));
  };

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Group
          justify="space-between"
          wrap="wrap"
          gap="sm"
          className={editing ? `${gridClasses.toolbar} ${gridClasses.toolbarEditing}` : gridClasses.toolbar}
          style={{ top: HEADER_HEIGHT }}
        >
          <div style={{ flex: '1 1 320px', minWidth: 0 }}>
            {editing && (
              <Text size="sm" c="dimmed" lineClamp={2}>
                Перетаскивайте за <IconLayoutGrid size={12} style={{ verticalAlign: 'middle' }} />, тяните за правый
                край — это ширина. Раскладка сохранится в этом браузере.
              </Text>
            )}
          </div>
          <Group gap="xs">
            {editing && (
              <Button
                variant="subtle"
                size="xs"
                leftSection={<IconLayoutDistributeHorizontal size={14} />}
                onClick={layout.compact}
                title="Переставит карточки и подгонит ширины так, чтобы ряды заполнялись целиком"
              >
                Уплотнить
              </Button>
            )}
            {editing && layout.isCustomised && (
              <Button variant="subtle" size="xs" leftSection={<IconRotate size={14} />} onClick={layout.reset}>
                Вернуть по умолчанию
              </Button>
            )}
            <Button
              variant={editing ? 'filled' : 'default'}
              size="xs"
              leftSection={<IconLayoutGrid size={14} />}
              onClick={() => setEditing((value) => !value)}
            >
              {editing ? 'Готово' : 'Настроить'}
            </Button>
          </Group>
        </Group>

        {editing && hiddenWidgets.length > 0 && (
          <Card withBorder padding="lg">
            <Text fw={600} mb={2}>
              Скрытые карточки
            </Text>
            <Text size="sm" c="dimmed" mb="md">
              Нажмите, чтобы вернуть на дашборд
            </Text>
            <Group gap="sm">
              {hiddenWidgets.map((widget) => (
                <Button
                  key={widget.id}
                  variant="default"
                  size="xs"
                  leftSection={<IconEye size={14} />}
                  onClick={() => layout.toggle(widget.id)}
                >
                  {widget.title}
                  {widget.isEmpty?.(ctx) && (
                    <Text span size="xs" c="dimmed">
                      {' '}
                      · пусто
                    </Text>
                  )}
                </Button>
              ))}
            </Group>
          </Card>
        )}

        {shown.length === 0 ? (
          <Alert variant="light" color="brand" icon={<IconInfoCircle size={18} />} title="Дашборд пуст">
            {hiddenWidgets.length > 0
              ? 'Все карточки скрыты. Нажмите «Настроить» и верните нужные.'
              : 'Пока нечего показать: добавьте пациентов, визиты или карты диспансерного учёта.'}
          </Alert>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={shown.map((widget) => widget.id)} strategy={rectSortingStrategy}>
              {/* Помечена, чтобы ручка изменения ширины могла измерить колонку сетки. */}
              <div className={gridClasses.grid} data-dashboard-grid>
                {shown.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    ctx={ctx}
                    editing={editing}
                    span={layout.spanOf(widget)}
                    wide={isWide}
                    onHide={() => layout.toggle(widget.id)}
                    onResize={(span) => layout.setSpan(widget.id, span)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}

        {!editing && shown.length > 0 && layout.all.length > shown.length && (
          <Title order={6} c="dimmed" fw={400} style={{ textAlign: 'center' }}>
            <Text span size="xs" c="dimmed">
              Показано {shown.length} из {layout.all.length} карточек · «Настроить», чтобы изменить
            </Text>
          </Title>
        )}
      </Stack>
    </Container>
  );
}
