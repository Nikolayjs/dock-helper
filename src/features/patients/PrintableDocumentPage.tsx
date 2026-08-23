import { Alert, Button, Card, Container, Group, Loader, Select, Stack, Text } from '@mantine/core';
import { IconArrowLeft, IconInfoCircle, IconPrinter, IconSettings } from '@tabler/icons-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { TemplateDocument } from './documents/TemplateDocument';
import { useDocumentTemplates } from './documents/useDocumentTemplates';
import { usePatients } from './usePatients';

export function PrintableDocumentPage() {
  const { id, visitId } = useParams<{ id: string; visitId: string }>();
  const navigate = useNavigate();
  const { patients, isLoading: patientsLoading } = usePatients();
  const { templates, isLoading: templatesLoading } = useDocumentTemplates();
  const [searchParams, setSearchParams] = useSearchParams();

  const patient = patients.find((p) => p.id === id);
  const visit = patient?.visits.find((v) => v.id === visitId);

  const templateIdParam = searchParams.get('templateId');
  const template = templates.find((t) => t.id === templateIdParam) ?? templates[0];

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
        <Button mt="md" leftSection={<IconArrowLeft size={16} />} variant="light" component={Link} to="/patients/documents">
          К шаблонам документов
        </Button>
      </Container>
    );
  }

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
              onChange={(v) => v && setSearchParams({ templateId: v })}
              data={templates.map((t) => ({ value: t.id, label: t.title }))}
              allowDeselect={false}
              w={220}
            />
            <Button variant="light" leftSection={<IconSettings size={16} />} component={Link} to="/patients/documents">
              Шаблоны
            </Button>
            <Button leftSection={<IconPrinter size={16} />} onClick={() => window.print()}>
              Печать
            </Button>
          </Group>
        </Group>

        <Card withBorder padding="xl">
          <div className="printable-document">
            <TemplateDocument template={template} patient={patient} visit={visit} />
          </div>
        </Card>

        <Text size="xs" c="dimmed" className="no-print">
          Реквизиты клиники и врача можно задать в профиле врача.
        </Text>
      </Stack>
    </Container>
  );
}
