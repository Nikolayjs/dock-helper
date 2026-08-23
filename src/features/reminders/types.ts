export interface Reminder {
  id: string;
  title: string;
  message: string;
  /** Local date-time, format 'YYYY-MM-DDTHH:mm' (no timezone offset). */
  datetime: string;
  notifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
