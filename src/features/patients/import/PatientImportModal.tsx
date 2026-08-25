import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  FileButton,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Table,
  Text,
} from '@mantine/core';
import { IconAlertTriangle, IconFileUpload, IconInfoCircle } from '@tabler/icons-react';

import { HttpRepositoryError } from '../../../lib/httpRepository';
import type { ImportResult, PatientInput } from '../usePatients';
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
  onImport: (patients: PatientInput[]) => Promise<ImportResult>;
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
];

const PREVIEW_ROWS = 8;

export function PatientImportModal({ opened, onClose, onImport }: PatientImportModalProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [importing, setImporting] = useState(false);

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
      setStage({ kind: 'review', rows, header, mapped: mapRows(rows, header) });
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
        stage.mapped.patients.map((p) => ({
          fullName: p.fullName,
          sex: p.sex,
          birthDate: p.birthDate,
          phone: p.phone,
          reminderDate: null,
          reminderNote: '',
        })),
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

  const columnOptions =
    stage.kind === 'review'
      ? stage.rows[stage.header.rowIndex].map((cell, index) => ({
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
