import { useRef, useState } from 'react';
import { Button, Group, Select, Stack, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconDownload, IconFileSpreadsheet, IconTrash } from '@tabler/icons-react';

import '../knowledgeBase/editorContent.css';
import { downloadXlsx } from '../../lib/xlsx/downloadXlsx';
import { readSheetFile } from '../../lib/xlsx/readSheet';
import { TableFileError } from '../patients/import/readTable';
import { usePatients } from '../patients/usePatients';
import { SheetEditor } from './SheetEditor';
import { trimTrailingRows } from './sheetOps';
import { blankSheet, type DoctorDocument, type DoctorDocumentKind, type DocumentSheet } from './types';
import type { DoctorDocumentInput } from './useDoctorDocuments';
import { RichTextField } from '../../components/common/RichTextField';
import { useRichTextEditor } from '../../components/common/useRichTextEditor';
import { FormActions } from '../../components/common/FormActions';

export type DoctorDocumentFormInput = Omit<DoctorDocumentInput, 'kind'>;

interface DoctorDocumentFormProps {
  kind: DoctorDocumentKind;
  initialDocument?: DoctorDocument;
  /** Пациент, выбранный заранее — когда документ заводят из карточки пациента. */
  initialPatientId?: string | null;
  onSubmit: (input: DoctorDocumentFormInput) => void;
  onCancel: () => void;
  onDelete?: () => void;
}

export function DoctorDocumentForm({
  kind,
  initialDocument,
  initialPatientId,
  onSubmit,
  onCancel,
  onDelete,
}: DoctorDocumentFormProps) {
  const { patients } = usePatients();
  const [title, setTitle] = useState(initialDocument?.title ?? '');
  const [summary, setSummary] = useState(initialDocument?.summary ?? '');
  const [tags, setTags] = useState<string[]>(initialDocument?.tags ?? []);
  const [patientId, setPatientId] = useState<string | null>(initialDocument?.patientId ?? initialPatientId ?? null);
  const [sheet, setSheet] = useState<DocumentSheet>(initialDocument?.sheet ?? blankSheet());

  const editor = useRichTextEditor(initialDocument?.content ?? '');
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  /**
   * Таблица из файла **заменяет** текущую, а не дописывается к ней.
   *
   * Здесь наоборот, чем при импорте Word в текст: там документ вставляется по месту курсора, потому
   * что дописать абзац к абзацу осмысленно. Две таблицы с разными заголовками склеить нельзя — из
   * них вышла бы третья, не похожая ни на одну. Замена очевидна и отменяется отказом от сохранения.
   */
  const importSheetFile = async (file: File) => {
    setImporting(true);
    try {
      const imported = await readSheetFile(file);
      if (imported.columns.length === 0) {
        notifications.show({ message: 'В файле не нашлось ни одной заполненной строки', color: 'yellow' });
        return;
      }
      setSheet({ columns: imported.columns, rows: imported.rows, totals: null });
      if (!title.trim()) setTitle(file.name.replace(/\.(xlsx|csv|txt)$/i, ''));
      notifications.show({
        message: `Таблица перенесена: ${imported.rows.length} строк, ${imported.columns.length} столбцов`,
        color: 'teal',
      });
    } catch (error) {
      notifications.show({
        message: error instanceof TableFileError ? error.message : 'Не удалось прочитать файл таблицы',
        color: 'red',
        autoClose: 12_000,
      });
    } finally {
      setImporting(false);
    }
  };

  const exportSheet = async () => {
    try {
      const clean = trimTrailingRows(sheet);
      await downloadXlsx({
        sheetName: title.trim() || 'Таблица',
        columns: clean.columns,
        rows: clean.rows,
        totals: clean.totals,
        formats: clean.formats,
        widths: clean.widths,
      });
    } catch {
      notifications.show({ message: 'Не удалось собрать файл .xlsx', color: 'red' });
    }
  };

  const canSave = title.trim().length > 0;

  const handleSubmit = () => {
    if (!canSave) return;
    onSubmit({
      title: title.trim(),
      summary: summary.trim(),
      patientId,
      tags,
      // Второе представление сохраняется пустым, а не выдумывается: колонки в базе две, и документ
      // одного вида ничего не должен записывать в тело другого.
      content: kind === 'text' ? (editor?.getHTML() ?? '') : '',
      sheet: kind === 'sheet' ? trimTrailingRows(sheet) : null,
    });
  };

  return (
    <Stack gap="md">
      <TextInput
        label="Название"
        placeholder={kind === 'sheet' ? 'Например: Реестр направлений на МСЭ' : 'Например: Направление на МСЭ'}
        value={title}
        onChange={(e) => setTitle(e.currentTarget.value)}
        required
      />
      <Textarea
        label="Краткое описание"
        placeholder="Коротко о содержании — показывается в списке"
        value={summary}
        onChange={(e) => setSummary(e.currentTarget.value)}
        autosize
        minRows={2}
        maxRows={4}
      />
      <Select
        label="Пациент"
        description="Необязательно — документ может не относиться ни к кому"
        placeholder="Без привязки"
        data={patients.map((patient) => ({ value: patient.id, label: patient.fullName }))}
        value={patientId}
        onChange={setPatientId}
        searchable
        clearable
        nothingFoundMessage="Никого не найдено"
      />
      <TagsInput label="Теги" placeholder="Например: экспертиза" value={tags} onChange={setTags} />

      {kind === 'text' ? (
        <RichTextField editor={editor} exportTitle={title} minHeight={320} onImportedTitle={(imported) => !title.trim() && setTitle(imported)} />
      ) : (
        <div>
          <Group justify="space-between" mb={6} wrap="wrap" gap="xs">
            <Text size="sm" fw={500}>
              Таблица
            </Text>
            <Group gap="xs">
              <Button
                size="compact-xs"
                variant="light"
                leftSection={<IconFileSpreadsheet size={14} />}
                loading={importing}
                onClick={() => sheetInputRef.current?.click()}
              >
                Импорт из Excel
              </Button>
              <Button size="compact-xs" variant="subtle" leftSection={<IconDownload size={14} />} onClick={() => void exportSheet()}>
                Скачать .xlsx
              </Button>
            </Group>
          </Group>

          <SheetEditor value={sheet} onChange={setSheet} />

          <input
            ref={sheetInputRef}
            type="file"
            accept=".xlsx,.csv,.txt,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.currentTarget.files?.[0];
              if (file) void importSheetFile(file);
              // Сбрасывается, чтобы выбор того же файла второй раз подряд снова вызвал событие.
              e.currentTarget.value = '';
            }}
          />
        </div>
      )}

      <FormActions>
        <Group justify="space-between" mt="sm">
          {initialDocument && onDelete ? (
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
              Удалить
            </Button>
          ) : (
            <div />
          )}
          <Group>
            <Button variant="default" onClick={onCancel}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={!canSave}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </FormActions>
    </Stack>
  );
}
