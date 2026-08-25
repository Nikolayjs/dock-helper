import { useState } from 'react';
import { Alert, Button, Container, FileInput, Group, Stack, Text, TextInput, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconArrowLeft, IconPhotoScan } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { LayoutEditor } from './LayoutEditor';
import { PAGE_PRESETS, emptyLayout } from './layoutTypes';
import type { TemplateLayout } from './layoutTypes';
import { cropAspect, cropForBackdrop, cropForRecognition, loadImageFromFile } from './scanImage';
import type { CropRect } from './scanImage';
import { ScanCropStep } from './ScanCropStep';
import { useDocumentTemplates } from './useDocumentTemplates';
import { useFormRecognition } from './useFormRecognition';

/**
 * Photograph of a blank form in, editable template out.
 *
 * Recognition is an accelerator here, not a dependency: "Пропустить распознавание" goes straight to
 * the editor with the scan as a backdrop to trace over. That matters because measured accuracy on
 * real photographs is uneven — plain sentences come back clean, anything crossed by a ruled line or
 * a stamp comes back as noise — and a doctor digitising a form once should never be stuck waiting
 * on OCR that cannot help with this particular sheet.
 */

type Step = 'pick' | 'crop' | 'edit';

/** Picks the paper size whose proportions are closest to the cropped form. */
function presetForAspect(aspect: number) {
  return PAGE_PRESETS.reduce((best, candidate) =>
    Math.abs(candidate.widthMm / candidate.heightMm - aspect) < Math.abs(best.widthMm / best.heightMm - aspect)
      ? candidate
      : best,
  );
}

export function ScanTemplatePage() {
  const navigate = useNavigate();
  const { addTemplate } = useDocumentTemplates();
  const { recognise, isRecognising, error } = useFormRecognition();

  const [step, setStep] = useState<Step>('pick');
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [title, setTitle] = useState('');
  const [layout, setLayout] = useState<TemplateLayout | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setLoadError(null);
    try {
      const img = await loadImageFromFile(file);
      setImage(img);
      setStep('crop');
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ''));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Не удалось открыть изображение');
    }
  };

  const buildLayout = (img: HTMLImageElement, rect: CropRect, blocks: TemplateLayout | null): TemplateLayout => {
    const preset = presetForAspect(cropAspect(img, rect));
    const base = blocks ?? emptyLayout(preset);
    return {
      ...base,
      // The recognised page size is a guess from the photo's proportions; the crop's proportions are
      // a better one, and either way the doctor can change it in the editor.
      pageWidthMm: preset.widthMm,
      pageHeightMm: preset.heightMm,
      backdropDataUrl: cropForBackdrop(img, rect),
    };
  };

  const handleRecognise = async (rect: CropRect) => {
    if (!image) return;
    try {
      const blob = await cropForRecognition(image, rect);
      const recognised = await recognise(blob);
      setLayout(buildLayout(image, rect, recognised));
      setStep('edit');
    } catch {
      // The mutation's error is rendered below; the doctor can retry or skip recognition entirely.
    }
  };

  const handleSkipRecognition = (rect: CropRect) => {
    if (!image) return;
    setLayout(buildLayout(image, rect, null));
    setStep('edit');
  };

  const handleSave = async () => {
    if (!layout || !title.trim()) return;
    setIsSaving(true);
    try {
      await addTemplate({ title: title.trim(), kind: 'layout', bodyHtml: '', layout });
      notifications.show({ message: 'Бланк сохранён как документ', color: 'teal' });
      navigate('/patients/documents');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconArrowLeft size={16} />}
          pl={8}
          style={{ alignSelf: 'flex-start' }}
          onClick={() => navigate('/patients/documents')}
        >
          К шаблонам документов
        </Button>

        <Title order={3}>Бланк из снимка</Title>

        {step === 'pick' && (
          <Stack gap="md" maw={560}>
            <Text size="sm" c="dimmed">
              Сфотографируйте или отсканируйте <b>чистый бланк</b> — без печати и без заполненных
              полей. Печать перекрывает текст, и под ней не разобрать ничего; на распечатанный
              документ она всё равно ставится потом.
            </Text>
            <FileInput
              label="Снимок бланка"
              placeholder="Выберите JPEG или PNG"
              accept="image/jpeg,image/png,image/webp"
              leftSection={<IconPhotoScan size={18} />}
              onChange={handleFile}
            />
            <Text size="xs" c="dimmed">
              HEIC с айфона не подойдёт. Настройки → Камера → Форматы → «Наиболее совместимые», либо
              отправьте снимок как JPEG.
            </Text>
            {loadError && (
              <Alert color="red" icon={<IconAlertTriangle size={18} />}>
                {loadError}
              </Alert>
            )}
          </Stack>
        )}

        {step === 'crop' && image && (
          <Stack gap="md" maw={720}>
            <ScanCropStep
              image={image}
              isBusy={isRecognising}
              onCancel={() => {
                setImage(null);
                setStep('pick');
              }}
              onConfirm={handleRecognise}
            />
            <Group justify="flex-end">
              <Button
                variant="subtle"
                color="gray"
                disabled={isRecognising}
                onClick={() => handleSkipRecognition({ x: 0.08, y: 0.08, width: 0.84, height: 0.84 })}
              >
                Пропустить распознавание
              </Button>
            </Group>
            {error && (
              <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
                {error.message} Можно попробовать ещё раз или перейти к редактору и набрать текст
                поверх снимка вручную.
              </Alert>
            )}
          </Stack>
        )}

        {step === 'edit' && layout && (
          <Stack gap="lg">
            <TextInput
              label="Название документа"
              placeholder="Например: Справка в детское учреждение"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              required
              maw={420}
            />

            <LayoutEditor layout={layout} onChange={setLayout} />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => navigate('/patients/documents')}>
                Отмена
              </Button>
              <Button onClick={handleSave} loading={isSaving} disabled={!title.trim()}>
                Сохранить
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Container>
  );
}
