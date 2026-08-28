import type { Note } from '../notes/types';
import type { Patient } from '../patients/types';
import type { PlannerCard } from '../planner/types';
import type { Reminder } from '../reminders/types';
import type { BarItem } from '../../components/common/RankedBarList';
import type { DocumentTemplate } from '../patients/documents/templateTypes';
import type { RankedTemplate } from './documentUsage';
import type {
  DispensaryQueue,
  LapsedPatient,
  LoadPeriod,
  LoadPoint,
  ReadingProgress,
  Slice,
  VisitCount,
} from './practice';
import type { getReferralBreakdown, ReferralEntry, ReferralPeriod, UpcomingReminder } from './selectors';

/**
 * Everything a widget may draw, computed once by the page.
 *
 * Widgets receive this instead of calling hooks themselves: the same patient list feeds eight of
 * them, and eight copies of the same `useMemo` would recompute the whole practice on every render.
 */
export interface DashboardContext {
  queue: DispensaryQueue;
  monthlyVisits: VisitCount;
  lapsed: LapsedPatient[];
  lapsedMonths: number;

  visitLoad: LoadPoint[];
  loadPeriod: LoadPeriod;
  setLoadPeriod: (period: LoadPeriod) => void;

  ageDistribution: Slice[];
  sexDistribution: Slice[];
  undatedCount: number;
  topDiagnoses: BarItem[];

  /** Начатые книги, недавняя первой. Карточка закрепляет первую и расставляет остальные. */
  readingShelf: ReadingProgress[];
  frequentTemplates: RankedTemplate[];
  templatesById: Map<string, DocumentTemplate>;
  allNotes: Note[];
  allReminders: Reminder[];

  /** Per-card choices kept with the layout — which cut «Структура пациентов» shows, and the like. */
  widgetSettings: {
    get: (id: string) => string | undefined;
    set: (id: string, value: string) => void;
    /** Порядок строк внутри карточки: избранные калькуляторы, книги. */
    getOrder: (id: string) => string[] | undefined;
    setOrder: (id: string, ids: string[]) => void;
  };

  referrals: {
    period: ReferralPeriod;
    setPeriod: (period: ReferralPeriod) => void;
    range: { start: string; end: string };
    breakdown: ReturnType<typeof getReferralBreakdown>;
    entries: ReferralEntry[];
    total: number;
  };

  todayNotes: Note[];
  notesActions: {
    open: (id: string) => void;
    edit: (id: string) => void;
    remove: (note: Note) => void;
    toggleItem: (noteId: string, itemId: string) => void;
  };

  dueCards: PlannerCard[];
  patientReminders: UpcomingReminder[];
  calendarReminders: Reminder[];
  recentPatients: Patient[];
}
