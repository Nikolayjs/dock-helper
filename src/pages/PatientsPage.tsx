import { Suspense, lazy, useMemo, useState } from 'react';
import { Alert, Badge, Box, Button, Card, Collapse, Container, Group, SegmentedControl, Stack, Tabs, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconAdjustmentsHorizontal, IconChartBar, IconClipboardHeart, IconFileDownload, IconFileUpload, IconInfoCircle, IconPlus, IconSearch, IconUsers, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useNavigate } from 'react-router-dom';

import { DISPENSARY_SORT_KEYS, DispensaryTable, dispensarySortValue, type DispensarySortKey } from '../features/patients/DispensaryTable';
import { PatientFilters } from '../features/patients/PatientFilters';
import { EMPTY_PATIENT_FILTERS, countActiveFilters, matchesPatientFilters, type PatientFilterState } from '../features/patients/patientFiltering';
import { diagnosisCodeOf, useIcd10Names } from '../features/patients/useIcd10Names';
import { sortRows, useTableSort } from '../lib/tableSort';
import { PATIENT_SORT_KEYS, PatientTable, patientSortValue, type PatientSortKey } from '../features/patients/PatientTable';
import type { DispensaryRecord } from '../features/patients/types';
import type { Patient } from '../features/patients/types';

/**
 * Импорт картотеки подключается только при открытии окна: за ним стоит `read-excel-file`, 13 КБ
 * gzip, а пользуются им редко — обычно один раз, при переезде с прежней программы.
 */
const PatientImportModal = lazy(() =>
  import('../features/patients/import/PatientImportModal').then((module) => ({ default: module.PatientImportModal })),
);
import { QUERY_KEY as DISPENSARY_KEY, useDispensary } from '../features/patients/useDispensary';
import { QUERY_KEY as PATIENTS_KEY, usePatients } from '../features/patients/usePatients';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { observationsWarning, visitsWarning } from '../features/patients/deleteWarnings';
import { CatalogPanel } from '../components/common/CatalogPanel';
import { PageToolbar } from '../components/common/PageToolbar';
import { QueryState } from '../components/common/QueryState';
import { readSetting, writeSetting } from '../lib/settingsStore';

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
  const [exporting, setExporting] = useState(false);

  /**
   * Выгрузка идёт по **всей** картотеке, а не по тому, что осталось на экране после отбора.
   *
   * Это резервная копия и переезд, а не «сохранить найденное»: выгрузка, молча урезанная фильтром,
   * который врач включил полчаса назад, — худший вид потери, потому что файл выглядит целым.
   * Писатель .xlsx подключается по нажатию: до него он в сборке не нужен.
   */
  const handleExport = async () => {
    setExporting(true);
    try {
      const { patientsWorkbook } = await import('../features/patients/import/exportPatients');
      const { downloadXlsx } = await import('../lib/xlsx/downloadXlsx');
      await downloadXlsx(patientsWorkbook(patients));
      notifications.show({ message: `Выгружено записей: ${patients.length}`, color: 'teal' });
    } finally {
      setExporting(false);
    }
  };
  // Окно снимается не по закрытию, а никогда: иначе Mantine нечего показывать во время
  // анимации ухода, и окно исчезало бы рывком.
  const [importMounted, setImportMounted] = useState(false);
  const [disclaimerDismissed, setDisclaimerDismissed] = useState(() => readSetting(DISCLAIMER_KEY) === '1');

  const dismissDisclaimer = () => {
    writeSetting(DISCLAIMER_KEY, '1');
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

  /* Вкладки одни на обе ветки раздела: они и есть переключатель между ними. */
  const sectionTabs = (
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

        {/* Вкладки — первая строка панели, а не остров над ней: см. `PageToolbar`. */}
        {tab === 'all' ? (
          <CatalogPanel
            tabs={sectionTabs}
            header={
              <Stack gap="md">
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
                  onClick={() => {
                    setImportMounted(true);
                    setImportOpen(true);
                  }}
                >
                  Загрузить базу
                </Button>
                {/*
                  Обратная операция к загрузке, и для медицинского продукта это условие доверия:
                  записи принадлежат врачу, а не нам. Заголовки те же, что понимает импорт, — файл
                  загружается обратно; визиты идут вторым листом, потому что в одном пришлось бы
                  либо повторять пациента на каждый приём, либо потерять приёмы.
                */}
                <Button
                  variant="light"
                  leftSection={<IconFileDownload size={18} />}
                  onClick={handleExport}
                  loading={exporting}
                  disabled={patients.length === 0}
                >
                  Выгрузить .xlsx
                </Button>
                <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/patients/new')}>
                  Добавить пациента
                </Button>
              </Group>
                </Group>

                {/* Фильтры внутри шапки, а не отдельной карточкой между ней и таблицей: они и есть
                    часть панели управления списком. */}
                <Collapse expanded={filtersOpen}>
                  <PatientFilters value={filters} onChange={setFilters} />
                </Collapse>
              </Stack>
            }
          >
            <QueryState isLoading={patientsLoading} error={patientsError} onRetry={refetchPatients} what="пациентов">
              {sorted.length === 0 ? (
                <Box p="xl">
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
                    {/* Действие лежит в шапке списка, а на телефоне шапка уже уехала вверх: без
                        кнопки прямо здесь пустая страница ничего не предлагает. */}
                    {!search.trim() && (
                      <Group gap="sm" mt="xs">
                        <Button leftSection={<IconPlus size={16} />} onClick={() => navigate('/patients/new')}>
                          Добавить пациента
                        </Button>
                        <Button
                          variant="light"
                          leftSection={<IconFileUpload size={16} />}
                          onClick={() => {
                            setImportMounted(true);
                            setImportOpen(true);
                          }}
                        >
                          Загрузить базу
                        </Button>
                      </Group>
                    )}
                  </Stack>
                </Box>
              ) : (
                <PatientTable
                  patients={sorted}
                  sort={patientSort.sort}
                  onSort={patientSort.toggle}
                  onOpen={(patient) => navigate(`/patients/${patient.id}`)}
                  onEdit={(patient) => navigate(`/patients/${patient.id}/edit`)}
                  onDelete={handleDelete}
                />
              )}
            </QueryState>
          </CatalogPanel>
        ) : (
          <>
            <PageToolbar tabs={sectionTabs}>
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
            </PageToolbar>

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

      {importMounted && (
        <Suspense fallback={null}>
          <PatientImportModal opened={importOpen} onClose={() => setImportOpen(false)} onImport={importPatients} />
        </Suspense>
      )}
    </Container>
  );
}
