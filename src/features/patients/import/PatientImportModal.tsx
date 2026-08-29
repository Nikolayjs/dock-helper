import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  FileButton,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Switch,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import dayjs from 'dayjs';
import { IconAlertTriangle, IconFileUpload, IconInfoCircle } from '@tabler/icons-react';

import { HttpRepositoryError } from '../../../lib/httpRepository';
import type { ImportPatientRow, ImportResult } from '../usePatients';
import { findHeader, mapRows, type HeaderMatch, type MappedRows, type PatientField } from './mapColumns';
import { TableFileError, readTableFile, type Cell } from './readTable';

/**
 * Imports an existing patient register from a spreadsheet.
 *
 * Nothing is written until the doctor has seen what the columns were taken to mean and what the
 * first rows turned into. Guessing a column wrong is not a cosmetic error here — it would put dates
 * of birth in the phone field across an entire practice — and the detected mapping is therefore
 * offered as a proposal to correct, not a decision already made.
 */

interface PatientImportModalProps {
  opened: boolean;
  onClose: () => void;
  onImport: (patients: ImportPatientRow[]) => Promise<ImportResult>;
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'review'; rows: Cell[][]; header: HeaderMatch; mapped: MappedRows }
  | { kind: 'done'; result: ImportResult; total: number };

const FIELD_LABELS: Array<{ field: PatientField; label: string }> = [
  { field: 'fullName', label: 'ФИО одной строкой' },
  { field: 'lastName', label: 'Фамилия' },
  { field: 'firstName', label: 'Имя' },
  { field: 'middleName', label: 'Отчество' },
  { field: 'sex', label: 'Пол' },
  { field: 'birthDate', label: 'Дата рождения' },
  { field: 'phone', label: 'Телефон' },
  { field: 'diagnosis', label: 'Диагноз' },
  { field: 'diagnosisCode', label: 'Код МКБ' },
  { field: 'registeredDate', label: 'Дата постановки на учёт' },
];

const PREVIEW_ROWS = 8;

export function PatientImportModal({ opened, onClose, onImport }: PatientImportModalProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [importing, setImporting] = useState(false);
  // Applied to everyone when the file names no diagnosis or no registration date of its own.
  const [onRegister, setOnRegister] = useState(false);
  const [fallbackDiagnosis, setFallbackDiagnosis] = useState('');
  const [fallbackCode, setFallbackCode] = useState('');
  const [fallbackDate, setFallbackDate] = useState<string>(dayjs().format('YYYY-MM-DD'));

  const reset = () => setStage({ kind: 'idle' });
  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setStage({ kind: 'reading' });
    try {
      const rows = await readTableFile(file);
      const header = findHeader(rows);
      if (!header) {
        setStage({
          kind: 'error',
          message: 'Не нашлась строка заголовков с ФИО или фамилией. Проверьте, что в файле есть шапка таблицы.',
        });
        return;
      }
      const mapped = mapRows(rows, header);
      // A file with a diagnosis column is a dispensary register; anything else has to be said out loud.
      if (mapped.patients.some((p) => p.diagnosis)) setOnRegister(true);
      setStage({ kind: 'review', rows, header, mapped });
    } catch (error) {
      // The underlying reason reaches the console: a spreadsheet that will not open is the sort of
      // thing a doctor reports as "it just says it failed", and the real message is what identifies it.
      if (!(error instanceof TableFileError)) console.error('Не удалось прочитать таблицу:', error);
      const message = error instanceof TableFileError ? error.message : 'Не удалось прочитать файл.';
      setStage({ kind: 'error', message });
    }
  };

  /** Re-runs the mapping whenever the doctor corrects a column, so the preview always shows the truth. */
  const remap = (field: PatientField, columnIndex: string | null) => {
    if (stage.kind !== 'review') return;
    const columns = { ...stage.header.columns };
    if (columnIndex === null) delete columns[field];
    else columns[field] = Number(columnIndex);
    const header = { ...stage.header, columns };
    setStage({ ...stage, header, mapped: mapRows(stage.rows, header) });
  };

  const runImport = async () => {
    if (stage.kind !== 'review') return;
    setImporting(true);
    try {
      const result = await onImport(
        stage.mapped.patients.map((p) => {
          // The file's own diagnosis and date win; the fields below fill in only what it lacks, so a
          // register carried over from earlier years keeps the dates the report is built from.
          const diagnosis = p.diagnosis || fallbackDiagnosis.trim();
          return {
            fullName: p.fullName,
            sex: p.sex,
            birthDate: p.birthDate,
            phone: p.phone,
            reminderDate: null,
            reminderNote: '',
            dispensary:
              onRegister && diagnosis
                ? {
                    diagnosis,
                    diagnosisCode: p.diagnosisCode || fallbackCode.trim() || undefined,
                    registeredDate: p.registeredDate ?? fallbackDate,
                  }
                : undefined,
          };
        }),
      );
      setStage({ kind: 'done', result, total: stage.mapped.patients.length });
    } catch (error) {
      setStage({
        kind: 'error',
        message: error instanceof HttpRepositoryError ? error.message : 'Не удалось сохранить пациентов.',
      });
    } finally {
      setImporting(false);
    }
  };

  const hasDiagnosisColumn = stage.kind === 'review' && stage.header.columns.diagnosis !== undefined;
  const hasRegisteredColumn = stage.kind === 'review' && stage.header.columns.registeredDate !== undefined;

  const columnOptions =
    stage.kind === 'review'
      ? (stage.rows[stage.header.rowIndex] ?? []).map((cell, index) => ({
          value: String(index),
          label: `${index + 1}. ${String(cell ?? '—').slice(0, 30)}`,
        }))
      : [];

  return (
    <Modal opened={opened} onClose={close} title="Загрузить базу пациентов" size="xl" radius="lg" centered>
      {stage.kind === 'idle' && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Таблица Excel (.xlsx) или CSV. Читаются только те поля, которые есть в карточке пациента: ФИО, пол,
            дата рождения и телефон — остальные колонки останутся в файле.
          </Text>
          <FileButton onChange={handleFile} accept=".xlsx,.csv,.txt,text/csv">
            {(props) => (
              <Button {...props} leftSection={<IconFileUpload size={16} />}>
                Выбрать файл
              </Button>
            )}
          </FileButton>
        </Stack>
      )}

      {stage.kind === 'reading' && (
        <Group justify="center" py="xl" gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Читаю файл…
          </Text>
        </Group>
      )}

      {stage.kind === 'error' && (
        <Stack gap="md">
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            {stage.message}
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={reset}>
              Выбрать другой файл
            </Button>
          </Group>
        </Stack>
      )}

      {stage.kind === 'review' && (
        <Stack gap="md">
          <Group gap="xs">
            <Badge variant="light" size="lg">
              Найдено пациентов: {stage.mapped.patients.length}
            </Badge>
            {stage.mapped.skippedRows.length > 0 && (
              <Badge variant="light" color="gray" size="lg">
                Строк без имени: {stage.mapped.skippedRows.length}
              </Badge>
            )}
          </Group>

          <div>
            <Text size="sm" fw={600} mb={6}>
              Какая колонка что означает
            </Text>
            <Group gap="xs" wrap="wrap">
              {FIELD_LABELS.map(({ field, label }) => (
                <Select
                  key={field}
                  size="xs"
                  w={185}
                  label={label}
                  placeholder="нет в файле"
                  data={columnOptions}
                  value={stage.header.columns[field] === undefined ? null : String(stage.header.columns[field])}
                  onChange={(value) => remap(field, value)}
                  clearable
                />
              ))}
            </Group>
          </div>

          <Card withBorder padding="sm" radius="md">
            <Switch
              checked={onRegister}
              onChange={(e) => setOnRegister(e.currentTarget.checked)}
              label="Поставить всех на диспансерный учёт"
              description="Каждому заводится карта учёта — они и попадут в статистику диспансеризации."
            />
            {onRegister && (
              <Group gap="xs" wrap="wrap" mt="sm" align="flex-end">
                {!hasDiagnosisColumn && (
                  <>
                    <TextInput
                      size="xs"
                      w={260}
                      label="Диагноз для всех"
                      description="В файле нет колонки с диагнозом"
                      placeholder="Например: Артериальная гипертензия"
                      value={fallbackDiagnosis}
                      onChange={(e) => setFallbackDiagnosis(e.currentTarget.value)}
                    />
                    <TextInput
                      size="xs"
                      w={120}
                      label="Код МКБ для всех"
                      placeholder="I11"
                      value={fallbackCode}
                      onChange={(e) => setFallbackCode(e.currentTarget.value)}
                    />
                  </>
                )}
                {!hasRegisteredColumn && (
                  <DatePickerInput
                    size="xs"
                    w={200}
                    label="Дата постановки на учёт"
                    description="Определяет графу отчёта"
                    valueFormat="DD.MM.YYYY"
                    value={fallbackDate}
                    onChange={(value) => setFallbackDate(value ? dayjs(value).format('YYYY-MM-DD') : '')}
                  />
                )}
                {hasDiagnosisColumn && hasRegisteredColumn && (
                  <Text size="xs" c="dimmed">
                    Диагноз и дата берутся из файла.
                  </Text>
                )}
              </Group>
            )}
          </Card>

          {stage.mapped.patients.length === 0 ? (
            <Alert color="orange" icon={<IconInfoCircle size={18} />}>
              Ни одной строки с именем. Проверьте, та ли колонка выбрана как ФИО.
            </Alert>
          ) : (
            <div>
              <Text size="sm" fw={600} mb={6}>
                Первые строки так и запишутся
              </Text>
              <ScrollArea.Autosize mah={260}>
                <Table striped withTableBorder fz="xs">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Строка</Table.Th>
                      <Table.Th>ФИО</Table.Th>
                      <Table.Th>Пол</Table.Th>
                      <Table.Th>Дата рождения</Table.Th>
                      <Table.Th>Телефон</Table.Th>
                      {onRegister && <Table.Th>Диагноз</Table.Th>}
                      {onRegister && <Table.Th>На учёте с</Table.Th>}
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {stage.mapped.patients.slice(0, PREVIEW_ROWS).map((p) => (
                      <Table.Tr key={p.sourceRow}>
                        <Table.Td c="dimmed">{p.sourceRow}</Table.Td>
                        <Table.Td>{p.fullName}</Table.Td>
                        <Table.Td>{p.sex === 'male' ? 'М' : p.sex === 'female' ? 'Ж' : '—'}</Table.Td>
                        <Table.Td c={p.birthDate ? undefined : 'dimmed'}>{p.birthDate ?? '—'}</Table.Td>
                        <Table.Td c={p.phone ? undefined : 'dimmed'}>{p.phone || '—'}</Table.Td>
                        {onRegister && (
                          <Table.Td c={p.diagnosis || fallbackDiagnosis ? undefined : 'dimmed'}>
                            {p.diagnosis || fallbackDiagnosis || 'не задан'}
                          </Table.Td>
                        )}
                        {onRegister && <Table.Td>{p.registeredDate ?? fallbackDate}</Table.Td>}
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea.Autosize>
            </div>
          )}

          <Group justify="space-between">
            <Button variant="default" onClick={reset}>
              Другой файл
            </Button>
            <Button onClick={runImport} loading={importing} disabled={stage.mapped.patients.length === 0}>
              Импортировать {stage.mapped.patients.length}
            </Button>
          </Group>
        </Stack>
      )}

      {stage.kind === 'done' && (
        <Stack gap="md">
          <Alert color="teal" icon={<IconInfoCircle size={18} />}>
            Добавлено пациентов: {stage.result.created} из {stage.total}.
            {stage.result.dispensaryCreated > 0 && ` Заведено карт учёта: ${stage.result.dispensaryCreated}.`}
            {stage.result.dispensarySkipped > 0 && ` Уже стояли на учёте: ${stage.result.dispensarySkipped}.`}
          </Alert>
          {stage.result.skipped.length > 0 && (
            <div>
              <Text size="sm" fw={600} mb={4}>
                Уже были в базе, поэтому пропущены: {stage.result.skipped.length}
              </Text>
              {/* Named rather than counted: a skip the doctor did not expect means the register holds
                  a duplicate, or someone was entered twice under slightly different spellings. */}
              <ScrollArea.Autosize mah={160}>
                <Text size="xs" c="dimmed">
                  {stage.result.skipped.join(' · ')}
                </Text>
              </ScrollArea.Autosize>
            </div>
          )}
          <Group justify="flex-end">
            <Button onClick={close}>Готово</Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
