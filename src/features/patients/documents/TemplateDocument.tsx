import { Typography } from '@mantine/core';

import { useAuth } from '../../auth/AuthContext';
import { getClinicSettings } from '../clinicSettings';
import type { Patient, PatientVisit } from '../types';
import { DocumentLetterhead } from './DocumentLetterhead';
import { DocumentSignature } from './DocumentSignature';
import { LayoutSheet } from './LayoutSheet';
import { copiesPerSheet } from './layoutTypes';
import { substitutePlaceholders } from './templateTypes';
import type { DocumentTemplate } from './templateTypes';

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
        resolveText={(text) => substitutePlaceholders(text, context)}
      />
    );
  }

  const html = substitutePlaceholders(template.bodyHtml, context);

  return (
    <div>
      <DocumentLetterhead />
      <Typography>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </Typography>
      <DocumentSignature />
    </div>
  );
}
