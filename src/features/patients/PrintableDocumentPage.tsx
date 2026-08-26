import { useEffect, useState } from 'react';
import { Alert, Button, Card, Container, Group, Loader, Select, Stack, Text } from '@mantine/core';
import { IconArrowLeft, IconInfoCircle, IconPrinter, IconSettings } from '@tabler/icons-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { COPIES_PER_SHEET_OPTIONS, copiesPerSheet, planSheet } from './documents/layoutTypes';
import { TemplateDocument } from './documents/TemplateDocument';
import { useDocumentTemplates } from './documents/useDocumentTemplates';
import { recordTemplateUse } from '../dashboard/documentUsage';
import { usePatients } from './usePatients';

export function PrintableDocumentPage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>();
  const navigate = useNavigate();
  const { patients, isLoading: patientsLoading } = usePatients();
  const { templates, isLoading: templatesLoading } = useDocumentTemplates();
  const [searchParams, setSearchParams] = useSearchParams();
  // Null means "whatever the template says". Kept out of the URL: it is a property of this one
  // trip to the printer, not of the document being looked at.
  const [copiesOverride, setCopiesOverride] = useState<number | null>(null);

  const patient = patients.find((p) => p.id === id);
  const visit = patient?.visits.find((v) => v.id === visitId);

  const templateIdParam = searchParams.get('templateId');
  const template = templates.find((t) => t.id === templateIdParam) ?? templates[0];

  // Единственный след, который печать вообще оставляет: у шаблона в базе нет истории. Считается
  // один раз на открытие документа — из этого дашборд собирает список частых бланков.
  useEffect(() => {
    if (template) recordTemplateUse(template.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id]);

  if (patientsLoading || templatesLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (!patient || !visit) {
    return (
      <Container size="md" px={0}>
        <Alert color="orange" icon={<IconInfoCircle size={18} />} title="Визит не найден">
          Возможно, пациент или визит были удалены.
        </Alert>
        <Button mt="md" leftSection={<IconArrowLeft size={16} />} variant="light" onClick={() => navigate('/patients')}>
          К списку пациентов
        </Button>
      </Container>
    );
  }

  if (!template) {
    return (
      <Container size="md" px={0}>
        <Alert color="orange" icon={<IconInfoCircle size={18} />} title="Нет доступных документов">
          Все шаблоны документов удалены — создайте новый в разделе «Документы».
        </Alert>
        <Button mt="md" leftSection={<IconArrowLeft size={16} />} variant="light" component={Link} to="/documents?tab=templates">
          К шаблонам документов
        </Button>
      </Container>
    );
  }

  // Imposition applies to recognised blanks only: a flow document is a page of text that ends where
  // it ends, with no physical size to tile.
  const layout = template.kind === 'layout' ? template.layout : null;
  const copies = layout ? (copiesOverride ?? copiesPerSheet(layout)) : 1;
  const plan = layout ? planSheet(layout, copies) : null;
  const sheetSummary = plan
    ? `Лист A4 ${plan.sheetWidthMm > plan.sheetHeightMm ? 'альбомная' : 'книжная'}, ${plan.cols}×${plan.rows}, размер ${Math.round(plan.scale * 100)}% — режется на ${copies}.`
    : null;

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap" className="no-print">
          <Button
            component={Link}
            to={`/patients/${patient.id}`}
            variant="subtle"
            color="gray"
            leftSection={<IconArrowLeft size={16} />}
            pl={8}
          >
            К пациенту
          </Button>
          <Group gap="sm">
            <Select
              value={template.id}
              onChange={(v) => {
                if (!v) return;
                setSearchParams({ templateId: v });
                // The count belongs to the form it was chosen for; carrying it to a different
                // template would silently impose nine of something that only fits two.
                setCopiesOverride(null);
              }}
              data={templates.map((t) => ({ value: t.id, label: t.title }))}
              allowDeselect={false}
              w={220}
            />
            {layout && (
              <Select
                aria-label="Копий на листе"
                value={String(copies)}
                onChange={(v) => v && setCopiesOverride(Number(v))}
                data={COPIES_PER_SHEET_OPTIONS.map((n) => ({ value: String(n), label: `${n} на листе` }))}
                allowDeselect={false}
                w={140}
              />
            )}
            <Button variant="light" leftSection={<IconSettings size={16} />} component={Link} to="/documents?tab=templates">
              Шаблоны
            </Button>
            <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
              Печать
            </Button>
          </Group>
        </Group>

        <Card withBorder padding="xl">
          <div style={{ overflowX: 'auto' }}>
            <div className="printable-document">
              <TemplateDocument
                template={template}
                patient={patient}
                visit={visit}
                copiesOverride={copiesOverride ?? undefined}
              />
            </div>
          </div>
        </Card>

        <Text size="xs" c="dimmed" className="no-print">
          {sheetSummary ?? 'Реквизиты клиники и врача можно задать в профиле врача.'}
        </Text>
      </Stack>
    </Container>
  );
}
