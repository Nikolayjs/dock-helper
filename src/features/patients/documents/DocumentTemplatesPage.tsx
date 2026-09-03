import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Alert, Button, Card, Group, Modal, Select, SimpleGrid, Stack, Text, TextInput, ThemeIcon, Tooltip } from '@mantine/core';
import { IconBuildingStore, IconCopy, IconFileText, IconFileOff, IconInfoCircle, IconPhotoScan, IconPlus, IconPrinter, IconSearch } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { CatalogToolbar } from '../../../components/common/CatalogPanel';
import { stripHtml } from '../../notes/textPreview';
import { usePatient, usePatients } from '../usePatients';
import { lastVisitOf } from '../utils';
import { isDemoSession } from '../../demo/demoSession';
import type { DocumentTemplate } from './templateTypes';
import { useDocumentTemplates } from './useDocumentTemplates';


export function DocumentTemplatesPage({ hint }: { hint?: string }) {
  const navigate = useNavigate();
  const { templates, isLoading, addTemplate } = useDocumentTemplates();
  const { patients } = usePatients();
  const [search, setSearch] = useState('');
  const [printTemplate, setPrintTemplate] = useState<DocumentTemplate | null>(null);

  /** Копия бланка — с пометкой в названии и сразу в редакторе. */
  const handleDuplicate = async (template: DocumentTemplate) => {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = template as DocumentTemplate & {
      createdAt?: string;
      updatedAt?: string;
    };
    const created = await addTemplate({ ...rest, title: `${template.title} — копия` });
    notifications.show({ message: 'Создана копия', color: 'teal' });
    navigate(`/documents/templates/${created.id}/edit`);
  };
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
    // Снимается только `use`: вкладка тоже живёт в адресе, и `setSearchParams({})` унесло бы её.
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.delete('use');
        return next;
      },
      { replace: true },
    );
  }, [useTemplateId, templates, setSearchParams]);

  // Запись целиком: печать идёт по последнему визиту, а в списке визитов больше нет.
  const { patient: selectedPatient } = usePatient(patientId ?? undefined);

  const closePrintModal = () => {
    setPrintTemplate(null);
    setPatientId(null);
  };

  const handlePrint = () => {
    if (!printTemplate || !patientId) return;
    const visitId = selectedPatient ? (lastVisitOf(selectedPatient)?.id ?? null) : null;
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
    <Stack gap="lg">
      <CatalogToolbar>
      <Stack gap="sm">
        {hint && (
          <Text size="sm" c="dimmed">
            {hint}
          </Text>
        )}
      <Group justify="space-between" wrap="wrap" gap="md">
        <TextInput
          placeholder="Поиск бланка…"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          w={260}
        />
        <Group gap="sm">
          {/* Распознавание снимка — Tesseract на сервере, в демо его нет. */}
          <Tooltip label="В демо-режиме недоступно: распознавание снимка выполняется на сервере" withArrow disabled={!isDemoSession()}>
            <Button
              variant="default"
              leftSection={<IconPhotoScan size={18} />}
              onClick={() => navigate('/documents/templates/scan')}
              disabled={isDemoSession()}
              data-disabled={isDemoSession() || undefined}
            >
              Бланк из снимка
            </Button>
          </Tooltip>
          <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/documents/templates/new')}>
            Создать бланк
          </Button>
          <Button
            variant="subtle"
            leftSection={<IconBuildingStore size={18} />}
            onClick={() => navigate('/store?tab=template')}
          >
            Ещё в магазине
          </Button>
        </Group>
      </Group>
      </Stack>
      </CatalogToolbar>

      {!isLoading && filtered.length === 0 && (
        <Card withBorder padding="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconFileOff size={24} />
            </ThemeIcon>
            <Text fw={600}>{templates.length === 0 ? 'Пока нет бланков' : 'Ничего не найдено'}</Text>
            <Text size="sm" c="dimmed" ta="center" maw={420}>
              {templates.length === 0
                ? 'Бланк — заготовка с подстановками: напишите её один раз, и она будет печататься с данными выбранного пациента.'
                : 'Попробуйте изменить запрос или создайте новый бланк.'}
            </Text>
            {templates.length === 0 && (
              <Group gap="sm" mt="xs">
                <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/documents/templates/new')}>
                  Создать бланк
                </Button>
                <Button variant="light" leftSection={<IconBuildingStore size={16} />} onClick={() => navigate('/store?tab=template')}>
                  Взять готовый в магазине
                </Button>
              </Group>
            )}
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
              onClick={() => navigate(`/documents/templates/${template.id}/edit`)}
            >
              <Group justify="space-between" align="flex-start" mb="sm">
                <ThemeIcon size={44} radius="md" variant="light" color="brand">
                  {template.kind === 'layout' ? <IconPhotoScan size={22} /> : <IconFileText size={22} />}
                </ThemeIcon>
                <Group gap={4}>
                  {/*
                    Бланк-раскладку по снимку собирают блок за блоком; вариант «то же, но для
                    детского приёма» иначе делается только заново. Копия открывается в редакторе —
                    её первым делом и правят.
                  */}
                  <Tooltip label="Дублировать">
                    <ActionIcon
                      aria-label="Дублировать"
                      variant="subtle"
                      color="gray"
                      size="lg"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleDuplicate(template);
                      }}
                    >
                      <IconCopy size={18} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Напечатать для пациента">
                    <ActionIcon
                      aria-label="Напечатать для пациента"
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

      <Modal opened={printTemplate !== null} onClose={closePrintModal} title="Печать бланка" radius="lg" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Бланк «{printTemplate?.title}» будет заполнен данными пациента и последнего визита.
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
    </Stack>
  );
}
