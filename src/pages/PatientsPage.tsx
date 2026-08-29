import { useMemo, useState } from 'react';
import { Alert, Badge, Button, Card, Collapse, Container, Group, SegmentedControl, Stack, Tabs, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconChartBar, IconClipboardHeart, IconFileUpload, IconInfoCircle, IconPlus, IconSearch, IconUsers, IconX } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { DISPENSARY_SORT_KEYS, DispensaryTable, dispensarySortValue, type DispensarySortKey } from '../features/patients/DispensaryTable';
import { PatientFilters } from '../features/patients/PatientFilters';
import { EMPTY_PATIENT_FILTERS, countActiveFilters, matchesPatientFilters, type PatientFilterState } from '../features/patients/patientFiltering';
import { diagnosisCodeOf, useIcd10Names } from '../features/patients/useIcd10Names';
import { sortRows, useTableSort } from '../lib/tableSort';
import { PatientImportModal } from '../features/patients/import/PatientImportModal';
import { PATIENT_SORT_KEYS, PatientTable, patientSortValue, type PatientSortKey } from '../features/patients/PatientTable';
import type { DispensaryRecord } from '../features/patients/types';
import type { Patient } from '../features/patients/types';
import { QUERY_KEY as DISPENSARY_KEY, useDispensary } from '../features/patients/useDispensary';
import { QUERY_KEY as PATIENTS_KEY, usePatients } from '../features/patients/usePatients';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { observationsWarning, visitsWarning } from '../features/patients/deleteWarnings';
import { QueryState } from '../components/common/QueryState';

const DISCLAIMER_KEY = 'medassist:patients-disclaimer-dismissed';

type PatientsTab = 'all' | 'dispensary';
type DispensaryFilter = 'active' | 'all';

export function PatientsPage() {
  const { patients, deletePatient, importPatients, isLoading: patientsLoading, error: patientsError, refetch: refetchPatients } = usePatients();
  const { records, deleteRecord, isLoading: recordsLoading, error: recordsError, refetch: refetchRecords } = useDispensary();
  const confirmDelete = useDeleteWithConfirm();
  const navigate = useNavigate();
  const [tab, setTab] = useState<PatientsTab>('all');
  const [search, setSearch] = useState('');
  const [dispensaryFilter, setDispensaryFilter] = useState<DispensaryFilter>('active');
  const [filters, setFilters] = useState<PatientFilterState>(EMPTY_PATIENT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Опрошенные по умолчанию: свежие визиты сверху и ближайшие осмотры сверху — то, ради чего
  // список открывают чаще всего.
  const patientSort = useTableSort<PatientSortKey>(
    { key: 'lastVisit', direction: 'desc' },
    { storageKey: 'medassist:sort:patients', keys: PATIENT_SORT_KEYS },
  );
  const dispensarySort = useTableSort<DispensarySortKey>(
    { key: 'nextVisit', direction: 'asc' },
    { storageKey: 'medassist:sort:dispensary', keys: DISPENSARY_SORT_KEYS },
  );
  const [importOpen, setImportOpen] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() => localStorage.getItem(DISCLAIMER_KEY) === '1');

  const dismissDisclaimer = () => {
    localStorage.setItem(DISCLAIMER_KEY, '1');
    setDisclaimerDismissed(true);
  };

  const patientsById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const activeFilters = countActiveFilters(filters);

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
    return patients.filter((patient) => {
      if (!matchesPatientFilters(patient, filters)) return false;
      if (!query) return true;
      return (
        patient.fullName.toLowerCase().includes(query) ||
        patient.phone.toLowerCase().includes(query) ||
        patient.visits.some((visit) => visit.diagnosis.toLowerCase().includes(query))
      );
    });
  }, [patients, search, filters]);

  const sorted = useMemo(
    () => sortRows(filtered, patientSort.sort, patientSortValue),
    [filtered, patientSort.sort],
  );

  const dispensaryFiltered = useMemo(() => {
    return dispensaryFilter === 'active' ? records.filter((r) => r.status === 'active') : records;
  }, [records, dispensaryFilter]);

  // Resolved here rather than in the table: sorting by diagnosis has to use the same names the rows
  // show, and a register imported as bare codes shows nomenclature names.
  const icdNames = useIcd10Names(
    dispensaryFiltered.map((record) => diagnosisCodeOf(record.diagnosis, record.diagnosisCode) ?? ''),
  );

  const sortedRecords = useMemo(
    () =>
      sortRows(dispensaryFiltered, dispensarySort.sort, (record, key) =>
        dispensarySortValue(record, key, patientsById, icdNames),
      ),
    [dispensaryFiltered, dispensarySort.sort, patientsById, icdNames],
  );

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
                {/* Shows the narrowed count as well as the total, so an unexpectedly short list is
                    explained by the toolbar rather than looking like missing data. */}
                {/* Пока список не загрузился, счётчик молчит: «Пока нет пациентов» при оборванном
                    запросе — утверждение о чужих данных, которого никто не проверял. */}
                {patientsLoading || patientsError
                  ? ''
                  : patients.length === 0
                    ? 'Пока нет пациентов'
                    : sorted.length === patients.length
                      ? `${patients.length} пациентов в списке`
                      : `Показано ${sorted.length} из ${patients.length}`}
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
                  variant={activeFilters > 0 ? 'filled' : 'light'}
                  color={activeFilters > 0 ? 'brand' : undefined}
                  leftSection={<IconAdjustmentsHorizontal size={18} />}
                  rightSection={
                    activeFilters > 0 ? (
                      <Badge size="sm" circle variant="white" c="brand">
                        {activeFilters}
                      </Badge>
                    ) : undefined
                  }
                  onClick={() => setFiltersOpen((open) => !open)}
                >
                  Фильтры
                </Button>
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

            <Collapse expanded={filtersOpen}>
              <Card withBorder padding="md">
                <PatientFilters value={filters} onChange={setFilters} />
              </Card>
            </Collapse>

            <QueryState isLoading={patientsLoading} error={patientsError} onRetry={refetchPatients} what="пациентов">
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
                    sort={patientSort.sort}
                    onSort={patientSort.toggle}
                    onOpen={(patient) => navigate(`/patients/${patient.id}`)}
                    onEdit={(patient) => navigate(`/patients/${patient.id}/edit`)}
                    onDelete={handleDelete}
                  />
                </Card>
              )}
            </QueryState>
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

            <QueryState isLoading={recordsLoading} error={recordsError} onRetry={refetchRecords} what="карты учёта">
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
                    sort={dispensarySort.sort}
                    onSort={dispensarySort.toggle}
                    icdNames={icdNames}
                    onOpen={(record) => navigate(`/patients/dispensary/${record.id}`)}
                    onEdit={(record) => navigate(`/patients/dispensary/${record.id}/edit`)}
                    onDelete={handleDeleteRecord}
                  />
                </Card>
              )}
            </QueryState>
          </>
        )}
      </Stack>

      <PatientImportModal opened={importOpen} onClose={() => setImportOpen(false)} onImport={importPatients} />
    </Container>
  );
}
