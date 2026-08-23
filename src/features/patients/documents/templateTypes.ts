import dayjs from 'dayjs';

import type { ClinicSettings } from '../clinicSettings';
import { REFERRAL_CATEGORY_LABELS } from '../referralUtils';
import type { Patient, PatientVisit } from '../types';

export interface DocumentTemplate {
  id: string;
  title: string;
  /** Tiptap-authored HTML, containing literal {{token}} placeholders inserted as plain text. */
  bodyHtml: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateContext {
  patient: Patient;
  visit: PatientVisit;
  doctorName: string;
  clinicSettings: ClinicSettings;
}

const EMPTY = '—';

interface PlaceholderDef {
  token: string;
  label: string;
  resolve: (ctx: TemplateContext) => string;
}

export const PLACEHOLDERS: PlaceholderDef[] = [
  { token: '{{patientName}}', label: 'ФИО пациента', resolve: (ctx) => ctx.patient.fullName || EMPTY },
  {
    token: '{{patientBirthDate}}',
    label: 'Дата рождения',
    resolve: (ctx) => (ctx.patient.birthDate ? dayjs(ctx.patient.birthDate).format('D MMMM YYYY') : EMPTY),
  },
  { token: '{{visitDate}}', label: 'Дата визита', resolve: (ctx) => dayjs(ctx.visit.date).format('D MMMM YYYY') },
  {
    token: '{{diagnosis}}',
    label: 'Диагноз',
    resolve: (ctx) =>
      ctx.visit.diagnosis ? (ctx.visit.diagnosisCode ? `${ctx.visit.diagnosisCode} — ${ctx.visit.diagnosis}` : ctx.visit.diagnosis) : EMPTY,
  },
  {
    token: '{{referralCategory}}',
    label: 'Категория направления',
    resolve: (ctx) => (ctx.visit.referralCategory ? REFERRAL_CATEGORY_LABELS[ctx.visit.referralCategory] : EMPTY),
  },
  { token: '{{referralDestination}}', label: 'Куда направлен', resolve: (ctx) => ctx.visit.referralDestination || EMPTY },
  { token: '{{doctorName}}', label: 'Врач', resolve: (ctx) => ctx.doctorName || EMPTY },
  { token: '{{specialty}}', label: 'Специализация врача', resolve: (ctx) => ctx.clinicSettings.specialty || EMPTY },
  { token: '{{clinicName}}', label: 'Название клиники', resolve: (ctx) => ctx.clinicSettings.clinicName || EMPTY },
  { token: '{{clinicAddress}}', label: 'Адрес клиники', resolve: (ctx) => ctx.clinicSettings.clinicAddress || EMPTY },
  { token: '{{licenseNumber}}', label: 'Номер лицензии', resolve: (ctx) => ctx.clinicSettings.licenseNumber || EMPTY },
  { token: '{{issueDate}}', label: 'Дата выдачи (сегодня)', resolve: () => dayjs().format('D MMMM YYYY') },
];

export function substitutePlaceholders(html: string, ctx: TemplateContext): string {
  return PLACEHOLDERS.reduce((result, placeholder) => result.split(placeholder.token).join(placeholder.resolve(ctx)), html);
}
