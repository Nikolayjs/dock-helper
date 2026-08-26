import type { Note } from '../notes/types';
import type { Patient } from '../patients/types';
import type { PlannerCard } from '../planner/types';
import type { Reminder } from '../reminders/types';
import type { BarItem } from '../../components/common/RankedBarList';
import type { AgeBand, DispensaryQueue, LapsedPatient, LoadPeriod, LoadPoint, VisitCount } from './practice';
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

  ageSex: AgeBand[];
  undatedCount: number;
  topDiagnoses: BarItem[];

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
