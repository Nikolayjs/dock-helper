import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Alert, Button, Card, Container, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core';
import { IconFileText, IconFileOff, IconInfoCircle, IconPhotoScan, IconPlus, IconPrinter, IconSearch } from '@tabler/icons-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { stripHtml } from '../../notes/textPreview';
import { usePatients } from '../usePatients';
import type { DocumentTemplate } from './templateTypes';
import { useDocumentTemplates } from './useDocumentTemplates';

/** Same recency rule as the visit list on a patient's own page: newest visit date, ties broken by creation order. */
function latestVisitId(patientId: string, patients: ReturnType<typeof usePatients>['patients']): string | null {
  const patient = patients.find((p) => p.id === patientId);
  if (!patient || patient.visits.length === 0) return null;
  return [...patient.visits].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0].id;
}

export function DocumentTemplatesPage() {
  const navigate = useNavigate();
  const { templates, isLoading } = useDocumentTemplates();
  const { patients } = usePatients();
  const [search, setSearch] = useState('');
  const [printTemplate, setPrintTemplate] = useState<DocumentTemplate | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

  // `?use=<id>` открывает окно выбора пациента сразу — так карточка частых бланков на дашборде
  // ведёт к печати, а не просто к списку. Параметр снимается, чтобы «назад» не открыл окно снова.
  const useTemplateId = searchParams.get('use');
  useEffect(() => {
    // Ждём загрузки: список приходит пустым, и снять параметр раньше — значит потерять запрос.
    if (!useTemplateId || templates.length === 0) return;
    const requested = templates.find((template) => template.id === useTemplateId);
    if (requested) setPrintTemplate(requested);
    setSearchParams({}, { replace: true });
  }, [useTemplateId, templates, setSearchParams]);

  const selectedPatient = patients.find((p) => p.id === patientId) ?? null;

  const closePrintModal = () => {
    setPrintTemplate(null);
    setPatientId(null);
  };

  const handlePrint = () => {
    if (!printTemplate || !patientId) return;
    const visitId = latestVisitId(patientId, patients);
    if (!visitId) return;
    navigate(`/patients/${patientId}/documents/${visitId}?templateId=${printTemplate.id}`);
    closePrintModal();
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((t) => t.title.toLowerCase().includes(query));
  }, [templates, search]);

  return (
    <Container size="xl" px={0}>
      <Group justify="space-between" mb="lg" wrap="wrap" gap="md">
        <Text c="dimmed" size="sm">
          {templates.length} документов доступно
        </Text>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconPhotoScan size={18} />}
            onClick={() => navigate('/patients/documents/scan')}
          >
            Бланк из снимка
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/patients/documents/new')}>
            Создать документ
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Поиск документа…"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="lg"
        w={300}
      />

      {!isLoading && filtered.length === 0 && (
        <Card withBorder padding="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconFileOff size={24} />
            </ThemeIcon>
            <Text fw={600}>Ничего не найдено</Text>
            <Text size="sm" c="dimmed">
              Попробуйте изменить запрос или создайте новый документ.
            </Text>
          </Stack>
        </Card>
      )}

      {filtered.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {filtered.map((template) => (
            <Card
              key={template.id}
              withBorder
              padding="lg"
              style={{ cursor: 'pointer', height: '100%' }}
              onClick={() => navigate(`/patients/documents/${template.id}/edit`)}
            >
              <Group justify="space-between" align="flex-start" mb="sm">
                <ThemeIcon size={44} radius="md" variant="light" color="brand">
                  {template.kind === 'layout' ? <IconPhotoScan size={22} /> : <IconFileText size={22} />}
                </ThemeIcon>
                <Tooltip label="Напечатать для пациента">
                  <ActionIcon
                    variant="light"
                    color="brand"
                    size="lg"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPrintTemplate(template);
                    }}
                  >
                    <IconPrinter size={18} />
                  </ActionIcon>
                </Tooltip>
              </Group>
              <Text fw={600} size="md" mb={4}>
                {template.title}
              </Text>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {template.kind === 'layout'
                  ? `Бланк из снимка, ${template.layout?.blocks.length ?? 0} блоков`
                  : stripHtml(template.bodyHtml) || 'Без текста'}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      )}

      <Modal opened={printTemplate !== null} onClose={closePrintModal} title="Печать документа" radius="lg" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Документ «{printTemplate?.title}» будет заполнен данными пациента и последнего визита.
          </Text>
          <Select
            label="Пациент"
            placeholder="Выберите пациента"
            data={patients.map((p) => ({ value: p.id, label: p.fullName }))}
            value={patientId}
            onChange={setPatientId}
            searchable
            required
          />
          {selectedPatient && selectedPatient.visits.length === 0 && (
            <Alert color="orange" icon={<IconInfoCircle size={16} />}>
              У этого пациента ещё нет визитов — сначала добавьте визит на его странице.
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={closePrintModal}>
              Отмена
            </Button>
            <Button
              leftSection={<IconPrinter size={16} />}
              disabled={!selectedPatient || selectedPatient.visits.length === 0}
              onClick={handlePrint}
            >
              Печать
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
}
