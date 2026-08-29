import dayjs from 'dayjs';

import { calcAge, formatAge } from '../utils';

import type { ClinicSettings } from '../clinicSettings';
import { REFERRAL_CATEGORY_LABELS } from '../referralUtils';
import type { Patient, PatientVisit } from '../types';
import type { DocumentTemplateKind, TemplateLayout } from './layoutTypes';
import { escapeHtml } from '../../../lib/escapeHtml';

export interface DocumentTemplate {
  id: string;
  title: string;
  /**
   * Which body field carries this template. 'flow' is everything authored in the Tiptap editor;
   * 'layout' is a scanned form reproduced as positioned blocks. Both live in the same list.
   */
  kind: DocumentTemplateKind;
  /** Tiptap-authored HTML, containing literal {{token}} placeholders inserted as plain text. Used when kind === 'flow'. */
  bodyHtml: string;
  /** Positioned blocks recognised from a scan. Used when kind === 'layout'. */
  layout: TemplateLayout | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateContext {
  patient: Patient;
  visit: PatientVisit;
  doctorName: string;
  clinicSettings: ClinicSettings;
}

/** Stand-in patient/visit so a template can be previewed and print-tested before it is ever used on a real record. */
export const SAMPLE_PATIENT: Patient = {
  id: 'sample',
  fullName: 'Иванов Иван Иванович',
  sex: 'male',
  birthDate: '1985-06-15',
  phone: '',
  reminderDate: null,
  reminderNote: '',
  visits: [],
  createdAt: '',
  updatedAt: '',
};

export const SAMPLE_VISIT: PatientVisit = {
  id: 'sample',
  date: new Date().toISOString().slice(0, 10),
  diagnosis: 'Острый бронхит',
  diagnosisCode: 'J20',
  note: '',
  referralCategory: 'consultation',
  referralDestination: 'Пульмонолог',
  createdAt: '',
};

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

  // ── Добавлено позже: то, ради чего справку чаще всего дописывают руками ────────────────────────
  {
    token: '{{patientAge}}',
    label: 'Возраст пациента',
    // Возраст на день выдачи, а не на день визита: справка датируется сегодняшним числом, и «45 лет»
    // в ней должно означать сегодняшние сорок пять.
    resolve: (ctx) => {
      const age = calcAge(ctx.patient.birthDate);
      return age === null ? EMPTY : formatAge(age);
    },
  },
  {
    token: '{{patientSex}}',
    label: 'Пол пациента',
    resolve: (ctx) => (ctx.patient.sex === 'male' ? 'мужской' : ctx.patient.sex === 'female' ? 'женский' : EMPTY),
  },
  { token: '{{patientPhone}}', label: 'Телефон пациента', resolve: (ctx) => ctx.patient.phone || EMPTY },
  {
    token: '{{diagnosisCode}}',
    label: 'Код диагноза (МКБ-10)',
    // Отдельно от `{{diagnosis}}`: в бланке под код бывает своя графа, а в ней название лишнее.
    resolve: (ctx) => ctx.visit.diagnosisCode || EMPTY,
  },
  { token: '{{visitNote}}', label: 'Заметка к визиту', resolve: (ctx) => ctx.visit.note || EMPTY },
  {
    token: '{{documentNumber}}',
    label: 'Номер документа',
    /**
     * Номер собирается из даты и хвоста идентификатора визита, а не из счётчика.
     *
     * Счётчик пришлось бы хранить на сервере и раздавать по одному на рабочее пространство —
     * иначе два врача в один день выдали бы справки с одним номером. А главное, номер обязан быть
     * **тем же самым** при повторной печати той же справки: врач печатает второй экземпляр, и
     * номер, изменившийся между двумя листами, делает их двумя разными документами.
     */
    resolve: (ctx) => `${dayjs(ctx.visit.date).format('YYYYMMDD')}-${ctx.visit.id.slice(-4).toUpperCase()}`,
  },
];

/**
 * Подстановка в **текст** — там, где результат рисуется React'ом как обычная строка.
 *
 * Так печатаются блоки бланка-скана: экранировать здесь нельзя, иначе фамилия «Иванов <b>» вышла бы
 * на бумагу с буквальными `&lt;`.
 */
export function substitutePlaceholdersText(text: string, ctx: TemplateContext): string {
  return PLACEHOLDERS.reduce((result, placeholder) => result.split(placeholder.token).join(placeholder.resolve(ctx)), text);
}

/**
 * Подстановка в **разметку** бланка: значения экранируются.
 *
 * Фамилия, диагноз, направление и реквизиты клиники — это текст, который врач набрал в поле формы,
 * а результат уходит в разметку страницы. Символ `<` в фамилии ломал печатную справку молча: часть
 * документа переставала печататься, а причина видна только в исходном коде страницы.
 */
export function substitutePlaceholdersHtml(html: string, ctx: TemplateContext): string {
  return PLACEHOLDERS.reduce(
    (result, placeholder) => result.split(placeholder.token).join(escapeHtml(placeholder.resolve(ctx))),
    html,
  );
}
