import { Code, Paper, Text, UnstyledButton } from '@mantine/core';

import { signatureParts, type FormulaHint } from '../../lib/sheet/formulaHint';
import classes from './FormulaHintBox.module.css';

/**
 * Подсказка, всплывающая под ячейкой, пока формулу набирают.
 *
 * Показывается ровно то, что нужно в этот момент: пока набирается имя — что вообще бывает; как
 * только скобка открыта — что писать внутри, с отметкой текущего аргумента; а у формулы без функций
 * (`=B2*600`) — что стоит в ячейках, на которые она ссылается. Список функций после открытой скобки
 * бесполезен, подпись до неё — не о чем.
 *
 * Итог формулы показывается всегда, когда он известен, — и в подписи функции тоже: набирающий
 * формулу видит её значение раньше, чем уведёт из ячейки курсор.
 *
 * Нажатие на подсказку **не должно уводить фокус** из ячейки: иначе набор прерывается, а подсказка
 * исчезает раньше, чем нажатие успевает сработать. Отсюда `onMouseDown` с `preventDefault` вместо
 * обычного `onClick`.
 */
interface FormulaHintBoxProps {
  hint: FormulaHint;
  /** Куда встать: прямоугольник поля, в котором набирают, в координатах окна. */
  anchor: DOMRect;
  onPick: (name: string) => void;
  /** Что стоит в ячейках, на которые ссылается формула. */
  values?: { ref: string; value: string }[];
  /** Во что формула считается прямо сейчас; ошибка — тоже значение. */
  result?: string;
}

/** Итог формулы — общий подвал у подписи и у ссылок. Ошибка красная, как и в самой ячейке. */
function Result({ result }: { result: string }) {
  return (
    <Text size="xs" mt={4} c={result.startsWith('#') ? 'red' : undefined}>
      <Text span c="dimmed">
        Значение:{' '}
      </Text>
      <Text span fw={600} ff="monospace">
        {result}
      </Text>
    </Text>
  );
}

export function FormulaHintBox({ hint, anchor, onPick, values, result }: FormulaHintBoxProps) {
  // Снизу, если там есть место, иначе сверху. Запас считается по тому, какая подсказка на самом
  // деле показывается: подпись функции занимает вчетверо меньше списка, и переворачивать её вверх
  // ради несуществующей нехватки места значит закрыть ею строку формул.
  const needed =
    hint.kind === 'signature'
      ? 96
      : hint.kind === 'references'
        ? 40 + Math.min(hint.refs.length, 5) * 22
        : 40 + Math.min(hint.matches.length, 7) * 40;
  const below = anchor.bottom + needed < window.innerHeight;
  const style = {
    left: Math.min(anchor.left, window.innerWidth - 340),
    top: below ? anchor.bottom + 4 : undefined,
    bottom: below ? undefined : window.innerHeight - anchor.top + 4,
  };

  if (hint.kind === 'signature') {
    const parts = signatureParts(hint.doc, hint.argument);
    return (
      <Paper className={classes.box} shadow="md" withBorder p="xs" style={style}>
        <Text size="sm" ff="monospace">
          {hint.doc.name}(
          {parts.map((part, index) => (
            <Text key={index} span ff="monospace" fw={part.current ? 700 : 400} c={part.current ? undefined : 'dimmed'}>
              {index > 0 ? '; ' : ''}
              {part.text}
            </Text>
          ))}
          )
        </Text>
        <Text size="xs" c="dimmed" mt={2}>
          {hint.doc.summary}
        </Text>
        {result ? <Result result={result} /> : null}
      </Paper>
    );
  }

  if (hint.kind === 'references') {
    return (
      <Paper className={classes.box} shadow="md" withBorder p="xs" style={style}>
        {(values ?? []).slice(0, 5).map((entry) => (
          <Text key={entry.ref} size="xs" ff="monospace">
            <Text span fw={600} ff="monospace">
              {entry.ref}
            </Text>
            <Text span c="dimmed">
              {' = '}
            </Text>
            {entry.value}
          </Text>
        ))}
        {result ? <Result result={result} /> : null}
      </Paper>
    );
  }

  return (
    <Paper className={classes.box} shadow="md" withBorder p={4} style={style}>
      {hint.matches.slice(0, 7).map((doc) => (
        <UnstyledButton
          key={doc.name}
          className={classes.item}
          // preventDefault удерживает фокус в ячейке — см. комментарий к компоненту.
          onMouseDown={(event) => {
            event.preventDefault();
            onPick(doc.name);
          }}
        >
          <Text size="sm" ff="monospace" fw={600}>
            {doc.name}
          </Text>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {doc.summary}
          </Text>
        </UnstyledButton>
      ))}
      <Text size="xs" c="dimmed" px={6} py={2}>
        Пример: <Code>{hint.matches[0]?.example}</Code>
      </Text>
    </Paper>
  );
}
