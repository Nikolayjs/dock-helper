import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Group,
  Radio,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconExternalLink, IconInfoCircle } from '@tabler/icons-react';

import { BackButton } from '../../components/common/BackButton';
import { FormActions } from '../../components/common/FormActions';
import { RecordEditorPage } from '../../components/common/RecordEditorPage';
import { RichTextField } from '../../components/common/RichTextField';
import { useRichTextEditor } from '../../components/common/useRichTextEditor';
import { useDiseases } from '../diseases/useDiseases';
import { useDrugs } from '../drugs/useDrugs';
import { useDocuments } from '../knowledgeBase/useDocuments';
import { CLIP_TARGET_LABELS, publishedHref, type ClipTarget } from './types';
import { useClips } from './useClips';

/**
 * Разбор одного клипа: куда он ляжет и в каком виде.
 *
 * Текст открывается **тем же редактором**, которым пишут статьи, и это не удобство. Readability
 * отдаёт `figure`, `section` и прочее, чего схема Tiptap не знает; попав в справочник как есть, оно
 * исчезло бы при первой правке — молча и необратимо. Здесь оно теряется на глазах у врача и до
 * публикации, а не после.
 */
export function ClipEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clips, isLoading, updateClip, publishClip } = useClips();
  const clip = clips.find((row) => row.id === id);

  const [title, setTitle] = useState('');
  const [target, setTarget] = useState<ClipTarget>('article');
  const [note, setNote] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [mode, setMode] = useState<'create' | 'append'>('create');
  const [entityId, setEntityId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editor = useRichTextEditor(clip?.contentHtml ?? '');

  // Запись приезжает списком, то есть может прийти позже первого рендера: форма заполняется, когда
  // она появилась, и один раз — иначе правка врача затиралась бы на каждой инвалидации кэша.
  useEffect(() => {
    if (!clip) return;
    setTitle(clip.title);
    setTarget(clip.target);
    setNote(clip.note);
    setTags(clip.tags);
    // У препарата новой карточки не бывает: заголовок страницы — не МНН.
    setMode(clip.target === 'drug' ? 'append' : 'create');
    editor?.commands.setContent(clip.contentHtml);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clip?.id, editor]);

  const published = clip?.status === 'published';

  return (
    <RecordEditorPage
      id={id}
      record={clip}
      isLoading={isLoading}
      notFound={{ text: 'Клип не найден', to: '/inbox', label: 'Во «Входящие»' }}
      back={<BackButton fallback="/inbox" />}
      title={clip?.title ?? ''}
      subtitle={
        clip && (
          <Group gap={8} wrap="wrap">
            <Badge variant="light" color="gray">
              {CLIP_TARGET_LABELS[clip.target]}
            </Badge>
            <Anchor href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" size="sm">
              <Group gap={4} wrap="nowrap" component="span">
                {clip.siteName || clip.sourceUrl}
                <IconExternalLink size={14} />
              </Group>
            </Anchor>
            {clip.byline && (
              <Text size="sm" c="dimmed">
                {clip.byline}
              </Text>
            )}
            {clip.publishedDate && (
              <Text size="sm" c="dimmed">
                {clip.publishedDate}
              </Text>
            )}
          </Group>
        )
      }
    >
      {clip && (
        <Stack gap="md">
          {published ? (
            <Alert color="teal" variant="light" icon={<IconInfoCircle size={16} />}>
              Уже опубликовано.{' '}
              <Anchor href={`/app${publishedHref(clip)}`}>Открыть запись в справочнике</Anchor>. Сам клип остаётся
              здесь — он единственный помнит, откуда эта запись взялась.
            </Alert>
          ) : (
            <PublishTarget
              target={target}
              onTarget={(value) => {
                setTarget(value);
                setMode(value === 'drug' ? 'append' : 'create');
                setEntityId(null);
              }}
              mode={mode}
              onMode={setMode}
              entityId={entityId}
              onEntity={setEntityId}
            />
          )}

          <TextInput
            label="Название записи"
            description="Заголовок страницы редко годится названием нозологии — поправьте его до публикации"
            value={title}
            onChange={(event) => setTitle(event.currentTarget.value)}
            disabled={published}
          />

          <TagsInput
            label="Теги"
            description={target === 'disease' ? 'Первый тег станет разделом справочника' : undefined}
            value={tags}
            onChange={setTags}
            disabled={published}
          />

          <Textarea
            label="Зачем сохранил"
            description="Только для вас: в справочник эта заметка не уходит"
            value={note}
            onChange={(event) => setNote(event.currentTarget.value)}
            autosize
            minRows={2}
            maxRows={6}
            disabled={published}
          />

          <RichTextField editor={editor} label="Текст" exportTitle={title || clip.title} minHeight="max(320px, 50vh)" />

          {!published && (
            <FormActions>
              <Button
                variant="light"
                color="gray"
                loading={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await updateClip(clip.id, {
                      title,
                      target,
                      note,
                      tags,
                      contentHtml: editor?.getHTML() ?? clip.contentHtml,
                    });
                    notifications.show({ message: 'Черновик сохранён', color: 'teal' });
                  } catch (error) {
                    notifications.show({
                      message: error instanceof Error ? error.message : 'Не удалось сохранить',
                      color: 'red',
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Сохранить черновик
              </Button>
              <Button
                loading={saving}
                disabled={!title.trim() || (mode === 'append' && !entityId)}
                onClick={async () => {
                  setSaving(true);
                  try {
                    // Правки уезжают до публикации: публикуется то, что лежит в клипе, и разъехаться
                    // этим двум нельзя.
                    await updateClip(clip.id, {
                      title,
                      target,
                      note,
                      tags,
                      contentHtml: editor?.getHTML() ?? clip.contentHtml,
                    });
                    const result = await publishClip(clip.id, {
                      mode,
                      entityId: mode === 'append' ? (entityId ?? undefined) : undefined,
                    });
                    notifications.show({ message: 'Опубликовано', color: 'teal' });
                    navigate(publishedHref({ ...clip, target, publishedEntityId: result.entityId }));
                  } catch (error) {
                    notifications.show({
                      message: error instanceof Error ? error.message : 'Не удалось опубликовать',
                      color: 'red',
                    });
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Опубликовать
              </Button>
            </FormActions>
          )}
        </Stack>
      )}
    </RecordEditorPage>
  );
}

/**
 * Куда положить: новая запись или дописать в существующую.
 *
 * По умолчанию предлагается **дописать**: в каталоге полторы тысячи препаратов и триста двадцать
 * девять нозологий, и клип про пневмонию, ставший ещё одной нозологией рядом с существующей, — это
 * не пополнение справочника, а его порча.
 */
function PublishTarget({
  target,
  onTarget,
  mode,
  onMode,
  entityId,
  onEntity,
}: {
  target: ClipTarget;
  onTarget: (value: ClipTarget) => void;
  mode: 'create' | 'append';
  onMode: (value: 'create' | 'append') => void;
  entityId: string | null;
  onEntity: (value: string | null) => void;
}) {
  const { documents } = useDocuments('article');
  const { diseases } = useDiseases();
  const { drugs } = useDrugs();

  const options = useMemo(() => {
    if (target === 'article') {
      return documents.map((document) => ({ value: document.id, label: document.title }));
    }
    if (target === 'disease') return diseases.map((disease) => ({ value: disease.id, label: disease.name }));
    return drugs.map((drug) => ({ value: drug.id, label: drug.inn }));
  }, [target, documents, diseases, drugs]);

  return (
    <Stack gap="xs">
      <Select
        label="Куда положить"
        data={(Object.keys(CLIP_TARGET_LABELS) as ClipTarget[]).map((value) => ({
          value,
          label: CLIP_TARGET_LABELS[value],
        }))}
        value={target}
        onChange={(value) => onTarget((value as ClipTarget) ?? 'article')}
        allowDeselect={false}
        maw={320}
      />

      <Radio.Group value={mode} onChange={(value) => onMode(value as 'create' | 'append')}>
        <Group gap="lg" mt={4}>
          {/* У препарата новой карточки не бывает: заголовок страницы — не МНН. */}
          <Radio value="create" label="Завести новую запись" disabled={target === 'drug'} />
          <Radio value="append" label="Дописать в существующую" />
        </Group>
      </Radio.Group>

      {mode === 'append' && (
        <Select
          label={target === 'drug' ? 'В какую карточку' : 'В какую запись'}
          description={
            target === 'drug' ? 'Текст ляжет в «Заметку врача» — карточку формуляра он не изменит' : undefined
          }
          placeholder="Начните печатать название"
          data={options}
          value={entityId}
          onChange={onEntity}
          searchable
          nothingFoundMessage="Ничего не найдено"
          limit={20}
          maw={480}
        />
      )}
    </Stack>
  );
}
