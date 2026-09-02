import { Typography } from '@mantine/core';

import { useAuth } from '../../auth/AuthContext';
import { getClinicSettings } from '../clinicSettings';
import type { Patient, PatientVisit } from '../types';
import { DocumentLetterhead } from './DocumentLetterhead';
import { DocumentSignature } from './DocumentSignature';
import { LayoutSheet } from './LayoutSheet';
import { copiesPerSheet } from './layoutTypes';
import { substitutePlaceholdersHtml, substitutePlaceholdersText } from './templateTypes';
import type { DocumentTemplate } from './templateTypes';
import { SafeHtml } from '../../../components/common/SafeHtml';

interface TemplateDocumentProps {
  template: DocumentTemplate;
  patient: Patient;
  visit: PatientVisit;
  /** Overrides the template's stored imposition for this one print. */
  copiesOverride?: number;
}

export function TemplateDocument({ template, patient, visit, copiesOverride }: TemplateDocumentProps) {
  const user = useAuth();
  const context = {
    patient,
    visit,
    doctorName: user.name,
    doctorRole: user.role,
    clinicSettings: getClinicSettings(),
  };

  // A layout template already contains its own letterhead — it is a reproduction of a printed form,
  // stamp corner and all — so it renders alone, without the letterhead and signature blocks that
  // frame a flow template. Adding them would print the clinic's name twice.
  if (template.kind === 'layout' && template.layout) {
    return (
      <LayoutSheet
        layout={template.layout}
        copies={copiesOverride ?? copiesPerSheet(template.layout)}
        resolveText={(text) => substitutePlaceholdersText(text, context)}
      />
    );
  }

  const html = substitutePlaceholdersHtml(template.bodyHtml, context);

  /**
   * Потоковый шаблон помечает себя `printable-flow`, и это не косметика.
   *
   * `.printable-document` носит и бланк-скан, и потоковый шаблон, а печатался он одним правилом
   * `position: fixed; inset: 0` — то есть ровно одним листом. Бланку это верно, он и есть лист;
   * выписка на полторы страницы теряла хвост молча. По этому классу печать разводит их надвое.
   *
   * Поля страницы объявляются здесь же, а не в `index.css`, по той же причине, что и у бланка:
   * `@page` глобален, и общее правило задело бы и отчёты, у которых свои таблицы во всю ширину.
   */
  return (
    <div className="printable-flow">
      <style>{'@page { margin: 16mm; }'}</style>
      <DocumentLetterhead />
      <Typography>
        <SafeHtml html={html} />
      </Typography>
      <DocumentSignature />
    </div>
  );
}
