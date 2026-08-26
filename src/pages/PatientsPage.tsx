import { useMemo, useState } from 'react';
import { Alert, Button, Card, Container, Group, SegmentedControl, Stack, Tabs, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconChartBar, IconClipboardHeart, IconFileUpload, IconInfoCircle, IconPlus, IconSearch, IconUsers, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { DispensaryTable } from '../features/patients/DispensaryTable';
import { PatientImportModal } from '../features/patients/import/PatientImportModal';
import { PatientTable } from '../features/patients/PatientTable';
import type { DispensaryRecord } from '../features/patients/types';
import type { Patient } from '../features/patients/types';
import { QUERY_KEY as DISPENSARY_KEY, useDispensary } from '../features/patients/useDispensary';
import { QUERY_KEY as PATIENTS_KEY, usePatients } from '../features/patients/usePatients';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { observationsWarning, visitsWarning } from '../features/patients/deleteWarnings';

const DISCLAIMER_KEY = 'medassist:patients-disclaimer-dismissed';

type PatientsTab = 'all' | 'dispensary';
type DispensaryFilter = 'active' | 'all';

export function PatientsPage() {
  const { patients, deletePatient, importPatients } = usePatients();
  const { records, deleteRecord } = useDispensary();
  const confirmDelete = useDeleteWithConfirm();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PatientsTab>('all');
  const [search, setSearch] = useState('');
  const [dispensaryFilter, setDispensaryFilter] = useState<DispensaryFilter>('active');
  const [importOpen, setImportOpen] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() => localStorage.getItem(DISCLAIMER_KEY) === '1');

  const dismissDisclaimer = () => {
    localStorage.setItem(DISCLAIMER_KEY, '1');
    setDisclaimerDismissed(true);
  };

  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);

  const handleDelete = (patient: Patient) =>
    confirmDelete({
      what: 'пациента',
      name: patient.fullName,
      alsoRemoves: visitsWarning(patient.visits.length),
      notice: 'Пациент удалён',
      queryKey: PATIENTS_KEY,
      id: patient.id,
      perform: () => deletePatient(patient.id),
    });

  const handleDeleteRecord = (record: DispensaryRecord) =>
    confirmDelete({
      what: 'карту учёта',
      name: patientsById.get(record.patientId)?.fullName,
      alsoRemoves: observationsWarning(record.observations.length),
      notice: 'Карта учёта удалена',
      queryKey: DISPENSARY_KEY,
      id: record.id,
      perform: () => deleteRecord(record.id),
    });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return patients;
    return patients.filter(
      (patient) =>
        patient.fullName.toLowerCase().includes(query) ||
        patient.phone.toLowerCase().includes(query) ||
        patient.visits.some((visit) => visit.diagnosis.toLowerCase().includes(query)),
    );
  }, [patients, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const lastA = a.visits[0]?.date;
      const lastB = b.visits[0]?.date;
      if (lastA && lastB) return lastB.localeCompare(lastA);
      if (lastA) return -1;
      if (lastB) return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [filtered]);

  const dispensaryFiltered = useMemo(() => {
    return dispensaryFilter === 'active' ? records.filter((r) => r.status === 'active') : records;
  }, [records, dispensaryFilter]);

  const sortedRecords = useMemo(() => {
    return [...dispensaryFiltered].sort((a, b) => {
      if (a.status === 'active' && b.status === 'active') {
        if (a.nextVisitDate && b.nextVisitDate) return a.nextVisitDate.localeCompare(b.nextVisitDate);
        if (a.nextVisitDate) return -1;
        if (b.nextVisitDate) return 1;
      }
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return b.registeredDate.localeCompare(a.registeredDate);
    });
  }, [dispensaryFiltered]);

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        {!disclaimerDismissed && (
          <Alert
            variant="light"
            color="brand"
            icon={<IconInfoCircle size={18} />}
            title="Это не медицинская карта"
            withCloseButton
            closeButtonLabel="Скрыть"
            onClose={dismissDisclaimer}
          >
            MedAssist — личный помощник врача для быстрых заметок. Раздел не заменяет медицинскую информационную
            систему клиники и не предназначен для хранения полных медицинских данных пациентов.
          </Alert>
        )}

        <Tabs value={tab} onChange={(v) => setTab((v as PatientsTab) ?? 'all')} variant="pills">
          <Tabs.List>
            <Tabs.Tab value="all" leftSection={<IconUsers size={16} />}>
              Все пациенты
            </Tabs.Tab>
            <Tabs.Tab value="dispensary" leftSection={<IconClipboardHeart size={16} />}>
              Диспансерные
            </Tabs.Tab>
          </Tabs.List>
        </Tabs>

        {tab === 'all' ? (
          <>
            <Group justify="space-between" align="flex-end" wrap="wrap">
              <Text c="dimmed" size="sm">
                {patients.length === 0 ? 'Пока нет пациентов' : `${patients.length} пациентов в списке`}
              </Text>
              <Group gap="sm" wrap="wrap">
                <TextInput
                  placeholder="Поиск по имени, телефону, диагнозу…"
                  leftSection={<IconSearch size={16} />}
                  value={search}
                  onChange={(e) => setSearch(e.currentTarget.value)}
                  w={280}
                />
                <Button
                  variant="light"
                  leftSection={<IconFileUpload size={18} />}
                  onClick={() => setImportOpen(true)}
                >
                  Загрузить базу
                </Button>
                <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/patients/new')}>
                  Добавить пациента
                </Button>
              </Group>
            </Group>

            {sorted.length === 0 ? (
              <Card withBorder padding="xl">
                <Stack align="center" gap="sm" py="xl">
                  <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                    {search.trim() ? <IconX size={24} /> : <IconUsers size={24} />}
                  </ThemeIcon>
                  <Text fw={600}>{search.trim() ? 'Ничего не найдено' : 'Пока нет пациентов'}</Text>
                  <Text size="sm" c="dimmed" ta="center" maw={360}>
                    {search.trim()
                      ? 'Попробуйте изменить запрос.'
                      : 'Добавьте пациента, чтобы вести историю визитов, диагнозы и короткие заметки.'}
                  </Text>
                </Stack>
              </Card>
            ) : (
              <Card withBorder padding={0}>
                <PatientTable
                  patients={sorted}
                  onOpen={(patient) => navigate(`/patients/${patient.id}`)}
                  onEdit={(patient) => navigate(`/patients/${patient.id}/edit`)}
                  onDelete={handleDelete}
                />
              </Card>
            )}
          </>
        ) : (
          <>
            <Group justify="space-between" align="flex-end" wrap="wrap">
              <SegmentedControl
                value={dispensaryFilter}
                onChange={(v) => setDispensaryFilter(v as DispensaryFilter)}
                data={[
                  { label: 'Активные', value: 'active' },
                  { label: 'Все', value: 'all' },
                ]}
              />
              <Group gap="sm" wrap="wrap">
                <Button variant="light" leftSection={<IconChartBar size={18} />} onClick={() => navigate('/patients/dispensary/stats')}>
                  Статистика
                </Button>
                <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/patients/dispensary/new')}>
                  Поставить на учёт
                </Button>
              </Group>
            </Group>

            {sortedRecords.length === 0 ? (
              <Card withBorder padding="xl">
                <Stack align="center" gap="sm" py="xl">
                  <ThemeIcon size={48} radius="xl" variant="light" color="gray">
                    <IconClipboardHeart size={24} />
                  </ThemeIcon>
                  <Text fw={600}>{dispensaryFilter === 'active' ? 'Нет активных карт учёта' : 'Пока нет диспансерных карт'}</Text>
                  <Text size="sm" c="dimmed" ta="center" maw={360}>
                    Поставьте пациента на диспансерный учёт, чтобы вести отдельную карту с диагнозом и датами осмотров.
                  </Text>
                </Stack>
              </Card>
            ) : (
              <Card withBorder padding={0}>
                <DispensaryTable
                  records={sortedRecords}
                  patientsById={patientsById}
                  onOpen={(record) => navigate(`/patients/dispensary/${record.id}`)}
                  onEdit={(record) => navigate(`/patients/dispensary/${record.id}/edit`)}
                  onDelete={handleDeleteRecord}
                />
              </Card>
            )}
          </>
        )}
      </Stack>

      <PatientImportModal opened={importOpen} onClose={() => setImportOpen(false)} onImport={importPatients} />
    </Container>
  );
}
