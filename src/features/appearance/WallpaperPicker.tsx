import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { Card, Loader, Slider, Stack, Switch, Text, ThemeIcon, Title, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconCheck, IconPhotoOff, IconUpload } from '@tabler/icons-react';

import { dominantColor } from './accent';
import { useAppearance } from './AppearanceProvider';
import {
  WALLPAPER_MAX_BYTES,
  WALLPAPER_MAX_DIMENSION,
  WALLPAPER_PRESETS,
  WallpaperTooLargeError,
  type Wallpaper,
} from './wallpaper';
import { resizeImageToDataUrl } from '../../lib/imageResize';
import classes from './WallpaperPicker.module.css';

interface TileProps {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Значение для `background-image`; без него на плитке рисуется значок. */
  background?: string;
  hint?: string;
  children?: ReactNode;
}

/** Образец обоев: выбирают глазами, поэтому плитка — это сами обои, а подпись под ней. */
function Tile({ label, active, onClick, background, hint, children }: TileProps) {
  return (
    <Stack gap={6} align="center">
      <UnstyledButton
        onClick={onClick}
        className={classes.tile}
        data-active={active || undefined}
        style={background ? { backgroundImage: background } : undefined}
        aria-label={hint ?? label}
        title={hint}
        aria-pressed={active}
      >
        {active && (
          <ThemeIcon size={20} radius="xl" color="brand" className={classes.check}>
            <IconCheck size={12} />
          </ThemeIcon>
        )}
        {!background && children}
      </UnstyledButton>
      <Text size="xs" c="dimmed" ta="center">
        {label}
      </Text>
    </Stack>
  );
}

/** Строка `data:` длиннее исходных байтов на треть — base64. */
function approximateBytes(dataUrl: string): number {
  return Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);
}

export function WallpaperPicker() {
  const { settings, setWallpaper, setVeil, setTint, accent } = useAppearance();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const custom = settings.wallpaper.kind === 'custom' ? settings.wallpaper : null;

  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);

  const apply = (wallpaper: Wallpaper) => {
    try {
      setWallpaper(wallpaper);
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Обои не сохранились',
        message: error instanceof WallpaperTooLargeError ? error.message : 'Не удалось записать настройку.',
      });
    }
  };

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      // JPEG, а не PNG: обои — это фотография, и PNG на снимке 1600 px весит мегабайты.
      const dataUrl = await resizeImageToDataUrl(file, WALLPAPER_MAX_DIMENSION, 'image/jpeg', 0.72);
      if (approximateBytes(dataUrl) > WALLPAPER_MAX_BYTES) {
        notifications.show({
          color: 'red',
          title: 'Картинка слишком тяжёлая',
          message: 'Даже после сжатия она не помещается в хранилище браузера. Возьмите снимок поменьше.',
        });
        return;
      }
      apply({ kind: 'custom', dataUrl, accent: await dominantColor(dataUrl) });
    } catch (error) {
      notifications.show({
        color: 'red',
        title: 'Не удалось открыть картинку',
        message: error instanceof Error ? error.message : 'Файл повреждён или не является изображением.',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card withBorder padding="lg">
      <Title order={4} mb={4}>
        Обои
      </Title>
      <Text size="sm" c="dimmed" mb="lg">
        Фон рабочей области. Карточки и таблицы остаются сплошными — записи пациентов обои не закрывают.
      </Text>

      <div className={classes.grid}>
        <Tile label="Без обоев" active={settings.wallpaper.kind === 'none'} onClick={() => apply({ kind: 'none' })}>
          <IconPhotoOff size={20} stroke={1.6} />
        </Tile>

        {WALLPAPER_PRESETS.map((preset) => (
          <Tile
            key={preset.id}
            label={preset.label}
            background={preset.image}
            active={settings.wallpaper.kind === 'preset' && settings.wallpaper.id === preset.id}
            onClick={() => apply({ kind: 'preset', id: preset.id })}
          />
        ))}

        {/* Нажатие на свою плитку всегда открывает выбор файла — и когда обоев ещё нет, и когда
            их хотят заменить: отдельная кнопка «заменить» рядом с плиткой была бы вторым способом
            сделать то же самое. */}
        <Tile
          label="Своя картинка"
          hint={custom ? 'Выбрать другую картинку' : undefined}
          background={custom ? `url("${custom.dataUrl}")` : undefined}
          active={settings.wallpaper.kind === 'custom'}
          onClick={openFilePicker}
        >
          {busy ? <Loader size={18} /> : <IconUpload size={20} stroke={1.6} />}
        </Tile>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleFile} />

      {settings.wallpaper.kind !== 'none' && (
        <Stack gap="lg" mt="xl">
          <div>
            <Text size="sm" fw={500} mb={2}>
              Приглушение
            </Text>
            <Text size="xs" c="dimmed" mb="sm">
              Обои лежат под мелкими надписями страницы — счётчиками списков и названиями вкладок. Чем ярче картинка,
              тем сильнее их стоит приглушить.
            </Text>
            <Slider
              value={Math.round(settings.veil * 100)}
              onChange={(value) => setVeil(value / 100)}
              min={20}
              max={90}
              step={5}
              label={(value) => `${value}%`}
              marks={[
                { value: 20, label: 'ярче' },
                { value: 90, label: 'тише' },
              ]}
              mb="lg"
            />
          </div>

          <Switch
            checked={settings.tint}
            onChange={(event) => setTint(event.currentTarget.checked)}
            label="Подстраивать цвета под обои"
            description={
              settings.tint && accent
                ? 'Приложение взяло цвет с обоев; светлота и контраст остались фирменными.'
                : settings.tint
                  ? 'У этих обоев нет своего цвета — приложение осталось в фирменных.'
                  : 'Приложение остаётся в фирменных цветах.'
            }
          />
        </Stack>
      )}
    </Card>
  );
}
