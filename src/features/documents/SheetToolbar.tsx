import { useState } from 'react';
import { ActionIcon, ColorSwatch, Divider, Group, Menu, Text, Tooltip } from '@mantine/core';
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconClearFormatting,
  IconColumnInsertRight,
  IconColumnRemove,
  IconDecimal,
  IconHelp,
  IconItalic,
  IconPaint,
  IconRowInsertBottom,
  IconRowRemove,
  IconSum,
  IconTextWrap,
} from '@tabler/icons-react';

import { commonFormat, FILL_COLORS, NUMBER_FORMATS, type CellRange } from './sheetFormat';
import type { CellFormat, SheetFormats } from './types';

export interface SheetToolbarProps {
  formats: SheetFormats | undefined;
  /** Выделение, к которому применяются кнопки; `null` — пока ни одна ячейка не выбрана. */
  range: CellRange | null;
  hasTotals: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onFormat: (patch: CellFormat) => void;
  onClearFormat: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onAddRow: () => void;
  onRemoveRows: () => void;
  onAddColumn: () => void;
  onRemoveColumns: () => void;
  onToggleTotals: () => void;
  onHelp: () => void;
}

/**
 * Панель редактирования таблицы.
 *
 * Кнопки работают с **выделением**, а не с одной ячейкой: разметить шапку или столбец — обычная
 * работа, и делать это по одной ячейке было бы издевательством. Пока не выбрано ничего, панель
 * выключена целиком, а не притворяется работающей.
 *
 * Начертание и выравнивание — переключатели: нажатие на уже включённое снимает его. Нажатой кнопка
 * показывается только тогда, когда свойство есть у **всех** ячеек выделения; смешанное выделение
 * не отмечается — обещать «здесь всё полужирное» там, где это не так, нельзя.
 */
export function SheetToolbar({
  formats,
  range,
  hasTotals,
  canUndo,
  canRedo,
  onFormat,
  onClearFormat,
  onUndo,
  onRedo,
  onAddRow,
  onRemoveRows,
  onAddColumn,
  onRemoveColumns,
  onToggleTotals,
  onHelp,
}: SheetToolbarProps) {
  const disabled = range === null;
  /**
   * Меню заливки закрывается вручную.
   *
   * Образцы цвета — обычные кнопки, а не пункты меню: в ряд они помещаются только так. Mantine
   * закрывает выпадающий список сам лишь по пункту, и без этого меню оставалось бы открытым поверх
   * таблицы, перехватывая следующее нажатие.
   */
  const [fillOpen, setFillOpen] = useState(false);
  const active = <K extends keyof CellFormat>(property: K) => (range ? commonFormat(formats, range, property) : undefined);

  const bold = active('bold');
  const italic = active('italic');
  const wrap = active('wrap');
  const align = active('align');

  const toggle = (patch: CellFormat) => () => onFormat(patch);

  return (
    <Group gap={4} wrap="wrap" mb="xs">
      <Tooltip label="Отменить" withArrow>
        <ActionIcon variant="subtle" color="gray" disabled={!canUndo} onClick={onUndo} aria-label="Отменить">
          <IconArrowBackUp size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Вернуть" withArrow>
        <ActionIcon variant="subtle" color="gray" disabled={!canRedo} onClick={onRedo} aria-label="Вернуть">
          <IconArrowForwardUp size={16} />
        </ActionIcon>
      </Tooltip>

      <Divider orientation="vertical" mx={4} />

      <Tooltip label="Полужирный" withArrow>
        <ActionIcon
          variant={bold ? 'light' : 'subtle'}
          color={bold ? 'brand' : 'gray'}
          disabled={disabled}
          aria-label="Полужирный"
          aria-pressed={bold ?? false}
          onClick={toggle({ bold: !bold })}
        >
          <IconBold size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Курсив" withArrow>
        <ActionIcon
          variant={italic ? 'light' : 'subtle'}
          color={italic ? 'brand' : 'gray'}
          disabled={disabled}
          aria-label="Курсив"
          aria-pressed={italic ?? false}
          onClick={toggle({ italic: !italic })}
        >
          <IconItalic size={16} />
        </ActionIcon>
      </Tooltip>

      <Divider orientation="vertical" mx={4} />

      {(
        [
          { value: 'left', label: 'По левому краю', icon: IconAlignLeft },
          { value: 'center', label: 'По центру', icon: IconAlignCenter },
          { value: 'right', label: 'По правому краю', icon: IconAlignRight },
        ] as const
      ).map(({ value, label, icon: Icon }) => (
        <Tooltip key={value} label={label} withArrow>
          <ActionIcon
            variant={align === value ? 'light' : 'subtle'}
            color={align === value ? 'brand' : 'gray'}
            disabled={disabled}
            aria-label={label}
            aria-pressed={align === value}
            onClick={toggle({ align: align === value ? undefined : value })}
          >
            <Icon size={16} />
          </ActionIcon>
        </Tooltip>
      ))}

      <Tooltip label="Переносить по словам" withArrow>
        <ActionIcon
          variant={wrap ? 'light' : 'subtle'}
          color={wrap ? 'brand' : 'gray'}
          disabled={disabled}
          aria-label="Переносить по словам"
          aria-pressed={wrap ?? false}
          onClick={toggle({ wrap: !wrap })}
        >
          <IconTextWrap size={16} />
        </ActionIcon>
      </Tooltip>

      <Divider orientation="vertical" mx={4} />

      <Menu position="bottom-start" withinPortal disabled={disabled} opened={fillOpen} onChange={setFillOpen}>
        <Menu.Target>
          <Tooltip label="Заливка" withArrow>
            <ActionIcon variant="subtle" color="gray" disabled={disabled} aria-label="Заливка">
              <IconPaint size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Заливка ячеек</Menu.Label>
          <Group gap={6} px="xs" pb={6}>
            {FILL_COLORS.map(({ color, label }) => (
              <Tooltip key={color} label={label} withArrow>
                <ColorSwatch
                  component="button"
                  color={`#${color}`}
                  size={22}
                  style={{ cursor: 'pointer' }}
                  aria-label={label}
                  onClick={() => {
                    onFormat({ fill: color });
                    setFillOpen(false);
                  }}
                />
              </Tooltip>
            ))}
          </Group>
          <Menu.Divider />
          <Menu.Item onClick={() => onFormat({ fill: undefined })}>Без заливки</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      <Menu position="bottom-start" withinPortal disabled={disabled}>
        <Menu.Target>
          <Tooltip label="Формат числа" withArrow>
            <ActionIcon variant="subtle" color="gray" disabled={disabled} aria-label="Формат числа">
              <IconDecimal size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Как показывать числа</Menu.Label>
          {NUMBER_FORMATS.map(({ value, label }) => (
            <Menu.Item key={value} onClick={() => onFormat({ numberFormat: value })}>
              {label}
            </Menu.Item>
          ))}
          <Menu.Divider />
          <Menu.Item onClick={() => onFormat({ numberFormat: undefined })}>Как есть</Menu.Item>
          <Menu.Label>
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'normal', maxWidth: 220 }}>
              Формат меняет вид числа в файле Excel; текст он не трогает
            </Text>
          </Menu.Label>
        </Menu.Dropdown>
      </Menu>

      <Tooltip label="Убрать оформление" withArrow>
        <ActionIcon variant="subtle" color="gray" disabled={disabled} aria-label="Убрать оформление" onClick={onClearFormat}>
          <IconClearFormatting size={16} />
        </ActionIcon>
      </Tooltip>

      <Divider orientation="vertical" mx={4} />

      <Tooltip label="Строка ниже" withArrow>
        <ActionIcon variant="subtle" color="gray" aria-label="Строка ниже" onClick={onAddRow}>
          <IconRowInsertBottom size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Удалить строки выделения" withArrow>
        <ActionIcon variant="subtle" color="red" disabled={disabled} aria-label="Удалить строки" onClick={onRemoveRows}>
          <IconRowRemove size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Столбец справа" withArrow>
        <ActionIcon variant="subtle" color="gray" aria-label="Столбец справа" onClick={onAddColumn}>
          <IconColumnInsertRight size={16} />
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Удалить столбцы выделения" withArrow>
        <ActionIcon variant="subtle" color="red" disabled={disabled} aria-label="Удалить столбцы" onClick={onRemoveColumns}>
          <IconColumnRemove size={16} />
        </ActionIcon>
      </Tooltip>

      <Divider orientation="vertical" mx={4} />

      <Tooltip label={hasTotals ? 'Убрать строку итогов' : 'Строка итогов: сумма под числовыми столбцами'} withArrow>
        <ActionIcon
          variant={hasTotals ? 'light' : 'subtle'}
          color={hasTotals ? 'brand' : 'gray'}
          aria-label="Строка итогов"
          aria-pressed={hasTotals}
          onClick={onToggleTotals}
        >
          <IconSum size={16} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label="Справка по формулам" withArrow>
        <ActionIcon variant="subtle" color="gray" aria-label="Справка по формулам" onClick={onHelp}>
          <IconHelp size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}
