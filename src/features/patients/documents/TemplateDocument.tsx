import { Typography } from '@mantine/core';

import { useAuth } from '../../auth/AuthContext';
import { getClinicSettings } from '../clinicSettings';
import type { Patient, PatientVisit } from '../types';
import { DocumentLetterhead } from './DocumentLetterhead';
import { DocumentSignature } from './DocumentSignature';
import { substitutePlaceholders } from './templateTypes';
import type { DocumentTemplate } from './templateTypes';

interface TemplateDocumentProps {
  template: DocumentTemplate;
  patient: Patient;
  visit: PatientVisit;
}

export function TemplateDocument({ template, patient, visit }: TemplateDocumentProps) {
  const user = useAuth();
  const html = substitutePlaceholders(template.bodyHtml, {
    patient,
    visit,
    doctorName: user.name,
    clinicSettings: getClinicSettings(),
  });

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
