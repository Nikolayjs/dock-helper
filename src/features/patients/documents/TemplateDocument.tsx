import { Typography } from '@mantine/core';

import { useAuth } from '../../auth/AuthContext';
import { getClinicSettings } from '../clinicSettings';
import type { Patient, PatientVisit } from '../types';
import { DocumentLetterhead } from './DocumentLetterhead';
import { DocumentSignature } from './DocumentSignature';
import { LayoutDocument } from './LayoutDocument';
import { substitutePlaceholders } from './templateTypes';
import type { DocumentTemplate } from './templateTypes';

interface TemplateDocumentProps {
  template: DocumentTemplate;
  patient: Patient;
  visit: PatientVisit;
}

export function TemplateDocument({ template, patient, visit }: TemplateDocumentProps) {
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
    return <LayoutDocument layout={template.layout} printSized resolveText={(text) => substitutePlaceholders(text, context)} />;
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
