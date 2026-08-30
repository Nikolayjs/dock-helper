import { Alert, Anchor, Group, Switch, Text, Tooltip } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import { withPlural } from '../../lib/plural';
import type { SpecialtyFilter } from './useSpecialtyFilter';

/**
 * Тумблер «Моя специальность» — один на все три справочника.
 *
 * Не показывается вовсе, пока специальность не выбрана: тумблер, который ничего не делает, — это
 * обещание возможности, которой нет. Там, где специальность выбрана, но справочнику она ничего не
 * даёт (у ЛОР-врача нет раздела клинических рекомендаций), тумблер стоит выключенным и говорит
 * почему: пропасть только на одной из трёх страниц — значит выглядеть поломкой.
 */
export function SpecialtyFilterSwitch({ filter }: { filter: SpecialtyFilter }) {
  if (!filter.specialty) return null;

  if (filter.emptyHere) {
    return (
      <Tooltip
        multiline
        w={280}
        label={`В этом справочнике нет ничего, размеченного как «${filter.specialty.name}», — отбирать нечего.`}
      >
        <Switch disabled checked={false} onChange={() => {}} label="Моя специальность" />
      </Tooltip>
    );
  }

  return (
    <Tooltip
      multiline
      w={280}
      label={`Показывать только то, что относится к специальности «${filter.specialty.name}». Специальность меняется в профиле.`}
    >
      <Switch
        checked={filter.enabled}
        onChange={(event) => filter.setEnabled(event.currentTarget.checked)}
        label="Моя специальность"
      />
    </Tooltip>
  );
}

interface NoticeProps {
  filter: SpecialtyFilter;
  /** Сколько записей отбор спрятал. */
  hidden: number;
  /** Сколько осталось видно — по нему и различается «сузили» от «спрятали всё». */
  visible: number;
  /** Формы существительного: «код», «кода», «кодов». */
  unit: [string, string, string];
}

/**
 * Сколько записей спрятано отбором — и это обязательная часть механизма, а не подпись к нему.
 *
 * Спрятанного не видно по определению. Врач, набравший «сахарный диабет» при включённом отборе по
 * кардиологии, получит пустой список и прочитает его как «такого кода нет» — то есть как ответ, а
 * не как следствие своей же настройки. Поэтому:
 *
 * - пока что-то найдено, под счётчиком стоит строка «скрыто N … — показать все»;
 * - когда отбор спрятал **всё**, это уже не примечание, а предупреждение: жёлтая плашка, число
 *   найденного без отбора и кнопка, снимающая его в одно нажатие.
 */
export function SpecialtyFilterNotice({ filter, hidden, visible, unit }: NoticeProps) {
  if (!filter.active || hidden === 0) return null;
  const name = filter.specialty?.name ?? '';
  const showAll = () => filter.setEnabled(false);

  if (visible === 0) {
    return (
      <Alert variant="light" color="yellow" icon={<IconAlertTriangle size={18} />}>
        <Text size="sm">
          По специальности «{name}» ничего не найдено. Без отбора страница показала бы{' '}
          {withPlural(hidden, ...unit)} — возможно, искомое относится к другому разделу.{' '}
          <Anchor component="button" type="button" size="sm" onClick={showAll}>
            Показать все
          </Anchor>
        </Text>
      </Alert>
    );
  }

  return (
    <Group gap={6}>
      <Text size="sm" c="dimmed">
        Отбор по специальности «{name}» скрыл {withPlural(hidden, ...unit)}.
      </Text>
      <Anchor component="button" type="button" size="sm" onClick={showAll}>
        Показать все
      </Anchor>
    </Group>
  );
}
