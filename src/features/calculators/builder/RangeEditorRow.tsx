import { useMediaQuery } from '@mantine/hooks';
import { ActionIcon, Grid, Group, NumberInput, Select, Textarea, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import type { InterpretationRange } from '../types';

const COLOR_OPTIONS = [
  { value: 'teal', label: 'Зелёный' },
  { value: 'mint', label: 'Мятный' },
  { value: 'yellow', label: 'Жёлтый' },
  { value: 'orange', label: 'Оранжевый' },
  { value: 'red', label: 'Красный' },
  { value: 'blue', label: 'Синий' },
  { value: 'brand', label: 'Фирменный' },
  { value: 'grape', label: 'Фиолетовый' },
  { value: 'gray', label: 'Серый' },
];

interface RangeEditorRowProps {
  range: InterpretationRange;
  /** Номер строки: подпись стоит над первой, а на узком экране — над каждой. */
  index: number;
  onChange: (range: InterpretationRange) => void;
  onRemove: () => void;
}

/**
 * Строка полосы толкования.
 *
 * **Смысл границ был написан подсказкой внутри поля, и это не работало дважды.** Поле шириной в две
 * колонки из двенадцати обрезало её на полуслове — «от (включ», «до (не вкл», — а как только врач
 * набирал число, подсказка исчезала вовсе: поле с содержимым перестаёт объяснять, что в нём.
 * Полуоткрытые границы — ровно то, о чём здесь легче всего ошибиться (полосы ИМТ «18,5–24,9» и
 * «25–29,9» не принимают 24,95 никуда), так что объяснение обязано оставаться на экране.
 *
 * Теперь смысл стоит **подписью над полем**, знаками: «от (≥)» и «до (<)». Знак короче слова и
 * помещается целиком, а разница между включающей и невключающей границей видна одним взглядом — без
 * неё «от» и «до» читаются одинаково. У возрастных полос анализатора подписи устроены так же, и там
 * знаки другие (`≥` и `≤`): границы там включающие обе, и это видно прямо в подписи.
 *
 * Подпись — над первой строкой, а на узком экране над каждой: там колонки складываются друг под
 * друга, и пять одинаковых коробок подряд не читаются. То же правило, что у условий анализатора.
 */
export function RangeEditorRow({ range, index, onChange, onRemove }: RangeEditorRowProps) {
  const narrow = useMediaQuery('(max-width: 48em)', false, { getInitialValueInEffect: false });
  const labelled = narrow || index === 0;

  return (
    // `flex-end`, а не `center`: подпись есть только у первой строки, и по центру поля разъехались бы.
    <Grid align="flex-end">
      <Grid.Col span={{ base: 6, sm: 2 }}>
        <NumberInput
          label={labelled ? 'от (≥)' : undefined}
          // Подпись видна не у каждой строки, а диктору нужна у каждой — и словами, а не знаком.
          aria-label="Нижняя граница, включается"
          // Пустая граница — не ноль, а «полоса открыта вниз»: так написана первая полоса у любой
          // шкалы («до 18,5 — дефицит массы»).
          placeholder="без границы"
          // Стрелки на пороге — шум, и это они отнимали ширину, из-за которой подсказка обрезалась.
          hideControls
          value={range.min ?? ''}
          onChange={(v) => onChange({ ...range, min: v === '' ? undefined : Number(v) })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 6, sm: 2 }}>
        <NumberInput
          label={labelled ? 'до (<)' : undefined}
          aria-label="Верхняя граница, не включается"
          placeholder="без границы"
          hideControls
          value={range.max ?? ''}
          onChange={(v) => onChange({ ...range, max: v === '' ? undefined : Number(v) })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 12, sm: 4 }}>
        <TextInput
          label={labelled ? 'Название' : undefined}
          aria-label="Название полосы"
          placeholder="Например, «Норма»"
          value={range.label}
          onChange={(e) => onChange({ ...range, label: e.currentTarget.value })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 9, sm: 3 }}>
        <Select
          label={labelled ? 'Цвет' : undefined}
          aria-label="Цвет полосы"
          data={COLOR_OPTIONS}
          value={range.color}
          allowDeselect={false}
          onChange={(v) => onChange({ ...range, color: v ?? 'brand' })}
        />
      </Grid.Col>
      <Grid.Col span={{ base: 3, sm: 1 }}>
        <Group justify="flex-end">
          <ActionIcon aria-label="Удалить диапазон" color="red" variant="subtle" onClick={onRemove} radius="md">
            <IconTrash size={16} />
          </ActionIcon>
        </Group>
      </Grid.Col>

      {/*
        Пояснение — то, ради чего толкование и нужно, и до сих пор его **нельзя было написать**:
        поле есть в записи и печатается под результатом, а в конструкторе его не было вовсе. Врач,
        собравший свой калькулятор, получал плашку из одного ярлыка — «Умеренная депрессия, 12», —
        тогда как число он и так видит. Ценность в том, чтобы сказать, меняет ли оно что-нибудь.

        Отдельной строкой во всю ширину, а не шестой колонкой: это две-три фразы, и в колонку они
        не помещаются ни на каком экране.
      */}
      <Grid.Col span={12}>
        <Textarea
          label={labelled ? 'Пояснение' : undefined}
          aria-label="Пояснение к полосе"
          description={labelled ? 'Показывается под результатом. Необязательно.' : undefined}
          placeholder="Что обычно делают на этой полосе и чего не стоит пропустить"
          autosize
          minRows={1}
          maxRows={4}
          value={range.note ?? ''}
          // Пустая строка — это «пояснения нет», а не пустое пояснение: в записи его тогда просто нет.
          onChange={(e) => onChange({ ...range, note: e.currentTarget.value || undefined })}
        />
      </Grid.Col>
    </Grid>
  );
}
