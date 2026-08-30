import { useRef } from 'react';
import { Button, Group, Input, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconPhoto, IconPhotoPlus, IconTextCaption, IconTrash } from '@tabler/icons-react';

/** Пропорция карточки в списке — эскиз показывается в том виде, в каком его увидят. */
const PREVIEW_WIDTH = 176;
const PREVIEW_HEIGHT = 99;

interface CoverFieldProps {
  /** Что будет сохранено: выбранный эскиз, картинка из текста или ничего. */
  preview: string | null;
  /** Обложка взята из текста, а не выбрана врачом. */
  fromText: boolean;
  /** Есть ли в тексте картинка, которую можно взять. */
  textImage: string | null;
  onPick: (file: File) => void;
  onUseText: () => void;
  onClear: () => void;
  busy: boolean;
}

/**
 * Обложка статьи в редакторе.
 *
 * Две дороги вместо одной: врач выбирает файл сам, а пока не выбрал — обложкой служит первая
 * картинка текста. Автоматическая обложка **названа вслух** и показана до сохранения: подстановка,
 * о которой не сказано, — это ровно то, за что переделывали нормы анализатора.
 *
 * Явный выбор автоматику отменяет — и «Убрать» тоже: статья без обложки бывает не по недосмотру, и
 * возвращать её первой же картинкой значило бы спорить с врачом.
 */
export function CoverField({ preview, fromText, textImage, onPick, onUseText, onClear, busy }: CoverFieldProps) {
  const fileInput = useRef<HTMLInputElement>(null);

  const openPicker = () => fileInput.current?.click();

  return (
    <Input.Wrapper
      label="Обложка"
      description="Показывается на карточке статьи в списке. Не выбрана — станет первая картинка из текста."
    >
      {/* Переносится: на телефоне рядом с эскизом остаётся ~160 px, и три кнопки вставали в
          колонку шириной в слово. Ниже 220 px они уезжают под эскиз целой строкой. */}
      <Group gap="md" align="flex-start" wrap="wrap" mt={8}>
        <div
          style={{
            width: PREVIEW_WIDTH,
            height: PREVIEW_HEIGHT,
            flexShrink: 0,
            borderRadius: 'var(--mantine-radius-md)',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--app-stripe-bg)',
            border: preview ? '1px solid var(--mantine-color-default-border)' : '1px dashed var(--mantine-color-default-border)',
          }}
        >
          {preview ? (
            <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <ThemeIcon variant="light" color="gray" size={34} radius="md">
              <IconPhoto size={18} />
            </ThemeIcon>
          )}
        </div>

        <Stack gap={6} style={{ flex: '1 1 220px', minWidth: 0 }}>
          <Group gap="xs" wrap="wrap">
            <Button
              size="xs"
              variant="default"
              leftSection={<IconPhotoPlus size={15} />}
              onClick={openPicker}
              loading={busy}
            >
              {preview && !fromText ? 'Заменить' : 'Выбрать файл'}
            </Button>
            {textImage && preview !== textImage && (
              <Button
                size="xs"
                variant="default"
                leftSection={<IconTextCaption size={15} />}
                onClick={onUseText}
                loading={busy}
              >
                Взять из текста
              </Button>
            )}
            {preview && (
              <Button size="xs" variant="subtle" color="red" leftSection={<IconTrash size={15} />} onClick={onClear}>
                Убрать
              </Button>
            )}
          </Group>

          <Text size="xs" c="dimmed">
            {preview
              ? fromText
                ? 'Первая картинка из текста — сохранится уменьшенной копией.'
                : 'Своя обложка. Картинка в тексте её не заменит.'
              : textImage
                ? 'Обложка убрана. Вернуть её можно кнопкой «Взять из текста».'
                : 'Обложки нет: карточка в списке покажет только текст.'}
          </Text>
        </Stack>
      </Group>

      <input
        ref={fileInput}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Сброс до обработки: без него повторный выбор того же файла не даёт события вовсе.
          event.target.value = '';
          if (file) onPick(file);
        }}
      />
    </Input.Wrapper>
  );
}
