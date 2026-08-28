import { Select } from '@mantine/core';

import { readRowLimit, ROW_LIMIT_DEFAULT, ROW_LIMIT_OPTIONS } from './rowLimit';

/**
 * Сколько строк карточка показывает, пока её не раскрыли.
 *
 * Живёт в шапке самой карточки, а не в панели настройки дашборда: там настраивают, какие карточки
 * вообще показывать, а здесь — сколько строк помещается, и это подбирают глядя на карточку.
 */
export function RowLimitSelect({
  value,
  onChange,
  fallback = ROW_LIMIT_DEFAULT,
}: {
  value: string | undefined;
  onChange: (value: string) => void;
  /**
   * Значение по умолчанию у карточки своё: у полки книг три строки, у калькуляторов пять. Контрол
   * обязан показывать то же число, что карточка на самом деле применяет, — иначе он показывает «5»
   * там, где нарисованы три.
   */
  fallback?: number;
}) {
  return (
    <Select
      size="xs"
      w={72}
      aria-label="Сколько строк показывать"
      data={ROW_LIMIT_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
      value={String(readRowLimit(value, fallback))}
      onChange={(next) => next && onChange(next)}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true }}
    />
  );
}
