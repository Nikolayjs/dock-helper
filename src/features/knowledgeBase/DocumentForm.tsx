import { Button, Group, Stack, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconTrash } from '@tabler/icons-react';
import { useState } from 'react';

import './editorContent.css';
import { coverFromFile, makeCover } from './cover';
import { CoverField } from './CoverField';
import { useFirstImage } from './useFirstImage';
import type { KnowledgeDocument } from './types';
import type { DocumentInput } from './useDocuments';
import { RichTextField } from '../../components/common/RichTextField';
import { useRichTextEditor } from '../../components/common/useRichTextEditor';
import { FormActions } from '../../components/common/FormActions';
import { useDirtyValue, useEditorDirty, useUnsavedGuard } from '../../components/common/unsavedChanges';
import { useSaveAction } from '../../components/common/useSaveAction';

export type DocumentFormInput = Omit<DocumentInput, 'kind' | 'author'>;

type CoverChoice =
  /** Обложки нет — ею станет первая картинка текста, если она там появится. */
  | { kind: 'auto' }
  /** Врач выбрал свою: уже уменьшенная копия, готовая к сохранению. */
  | { kind: 'picked'; src: string }
  /** Врач убрал обложку — и картинка в тексте её не вернёт. */
  | { kind: 'none' };

interface DocumentFormProps {
  initialDocument?: KnowledgeDocument;
  onSubmit: (input: DocumentFormInput) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
  contentMinHeight?: number | string;
  /**
   * Обложка — только у статей.
   *
   * Клинические рекомендации показываются таблицей, как формуляр: картинке в строке места нет, и
   * поле, которое некуда показать, было бы обещанием без адресата.
   */
  withCover?: boolean;
}

export function DocumentForm({
  initialDocument,
  onSubmit,
  onCancel,
  onDelete,
  contentMinHeight = 220,
  withCover = false,
}: DocumentFormProps) {
  const [title, setTitle] = useState(initialDocument?.title ?? '');
  const [summary, setSummary] = useState(initialDocument?.summary ?? '');
  const [tags, setTags] = useState<string[]>(initialDocument?.tags ?? []);

  const editor = useRichTextEditor(initialDocument?.content ?? '');

  /**
   * Откуда берётся обложка. `auto` — из первой картинки текста, и это состояние по умолчанию:
   * статья, написанная до появления обложек, получит её сама, а врач увидит это до сохранения.
   * Явный выбор и явное «Убрать» автоматику отменяют — иначе кнопка спорила бы с врачом.
   */
  const [cover, setCover] = useState<CoverChoice>(() => {
    const stored = initialDocument?.coverDataUrl;
    if (stored) return { kind: 'picked', src: stored };
    // Пустая строка — обложку убрали руками; `null` и отсутствие документа — её просто не было.
    return stored === '' ? { kind: 'none' } : { kind: 'auto' };
  });
  const [coverBusy, setCoverBusy] = useState(false);
  const textImage = useFirstImage(editor);
  const coverPreview = cover.kind === 'picked' ? cover.src : cover.kind === 'auto' ? textImage : null;

  const canSave = title.trim().length > 0;

  const fieldsDirty = useDirtyValue({ title, summary, tags, cover });
  const textDirty = useEditorDirty(editor);
  const guard = useUnsavedGuard(fieldsDirty || textDirty);
  const { saving, save } = useSaveAction(guard, onSubmit);

  /**
   * Файл ужимается сразу, а не при сохранении: врач должен видеть тот самый эскиз, который уйдёт в
   * базу, — и знать об отказе тогда же, когда выбрал картинку, а не через минуту после «Сохранить».
   */
  const pickCoverFile = async (file: File) => {
    setCoverBusy(true);
    try {
      setCover({ kind: 'picked', src: await coverFromFile(file) });
    } catch (error) {
      // Отказ приходит словами: молча не записаться хуже, чем не принять, — как с обоями.
      const message = error instanceof Error ? error.message : 'Не удалось прочитать картинку';
      notifications.show({ color: 'red', message });
    } finally {
      setCoverBusy(false);
    }
  };

  const takeCoverFromText = async () => {
    if (!textImage) return;
    setCoverBusy(true);
    const src = await makeCover(textImage);
    setCoverBusy(false);
    if (src) setCover({ kind: 'picked', src });
    else notifications.show({ color: 'red', message: 'Эту картинку не удалось сделать обложкой' });
  };

  const handleSubmit = () => {
    if (!canSave || !editor) return;
    void (async () => {
      // Автоматическая обложка ужимается здесь, а не на каждое нажатие: пока идёт набор, показывать
      // хватает и самой картинки из текста, а уменьшенная копия нужна только той, что уходит в базу.
      const coverDataUrl =
        cover.kind === 'picked'
          ? cover.src
          : cover.kind === 'auto'
            ? textImage
              ? await makeCover(textImage)
              : null
            : // Убрал руками — так и записываем: пустая строка отличает это от «обложки не было».
              '';

      await save({
        title: title.trim(),
        summary: summary.trim(),
        tags,
        content: editor.getHTML(),
        coverDataUrl: withCover ? coverDataUrl : (initialDocument?.coverDataUrl ?? null),
      });
    })();
  };

  return (
    <Stack gap="md">
      <TextInput
        label="Заголовок"
        placeholder="Название"
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
      <TagsInput label="Теги" placeholder="Например: кардиология" value={tags} onChange={setTags} />

      {withCover && (
        <CoverField
          preview={coverPreview}
          fromText={cover.kind === 'auto'}
          textImage={textImage}
          onPick={(file) => void pickCoverFile(file)}
          onUseText={() => void takeCoverFromText()}
          onClear={() => setCover({ kind: 'none' })}
          busy={coverBusy}
        />
      )}

      <RichTextField
        editor={editor}
        minHeight={contentMinHeight}
        exportTitle={title}
        exportAuthor={initialDocument?.author}
        onImportedTitle={(imported) => {
          if (!title.trim()) setTitle(imported);
        }}
        hint={
          <Text size="xs" c="dimmed" mb={6}>
            Совет:{' '}
            <Text span ff="monospace">
              [[Название заметки]]
            </Text>{' '}
            открывает другую запись базы знаний по названию
          </Text>
        }
      />

      {guard.render({ onSave: canSave ? handleSubmit : undefined })}

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
            <Button onClick={handleSubmit} loading={saving} disabled={!canSave}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </FormActions>
    </Stack>
  );
}
