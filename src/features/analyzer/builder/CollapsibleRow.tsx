import type { ReactNode } from 'react';
import { ActionIcon, Card, Group, Text, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle, IconChevronDown, IconChevronRight, IconTrash } from '@tabler/icons-react';

import classes from './CollapsibleRow.module.css';

/**
 * Строка списка в конструкторе: свёрнута, пока её не открыли.
 *
 * Общий анализ крови — это тридцать показателей и десяток правил, и в развёрнутом виде каждый
 * из них занимает пол-экрана. Замер до правки: страница конструктора **35 638 px на компьютере и
 * 49 192 px на телефоне** — сорок и пятьдесят пять экранов прокрутки, 978 полей ввода и почти
 * пятнадцать тысяч узлов разметки. Найти в этом нужный показатель нельзя, а любая набранная буква
 * стоила 1,7 с (замер на замедленном вшестеро процессоре).
 *
 * Правят при этом **один** показатель за раз. Поэтому строка показывает ровно то, по чему её
 * узнают, а поля разворачивает по нажатию — и содержимое до этого момента **не отрисовано вовсе**,
 * а не спрятано стилем: спрятанное стоит столько же, сколько показанное.
 *
 * Что обязано быть видно свёрнутым:
 *
 * - **Название и краткое описание.** Иначе список превращается в тридцать одинаковых строк, и
 *   открывать придётся каждую.
 * - **Отметка об ошибке.** Форма не сохраняется, пока в ней есть пустое обязательное поле или
 *   повторяющийся ключ; ошибка, спрятанная внутри свёрнутой строки, — это жалоба без адреса.
 * - **Удаление.** Оно относится ко всей строке, а не к её содержимому, и разворачивать ради него
 *   нечего.
 */
interface CollapsibleRowProps {
  /**
   * Что это за строка: «Показатель», «Правило».
   *
   * На экране не печатается: раздел уже так и называется, а тридцать одинаковых подписей подряд —
   * это тридцать строк, занятых тем, что и так известно. Остаётся диктору и подписи кнопки удаления.
   */
  kind: string;
  /** Название: имя показателя или заключение правила. Пусто — так и говорим. */
  title: string;
  /** Одна строка про содержимое: ключ, единицы, норма — то, по чему строку узнают в списке. */
  summary?: string;
  open: boolean;
  onToggle: () => void;
  onRemove: () => void;
  /** Есть ли в строке то, из-за чего форма не сохранится. */
  invalid?: boolean;
  children: ReactNode;
}

export function CollapsibleRow({ kind, title, summary, open, onToggle, onRemove, invalid, children }: CollapsibleRowProps) {
  return (
    <Card withBorder padding={0} radius="md">
      <Group gap={0} wrap="nowrap" align="stretch">
        {/*
          Заголовок — кнопка, а не строка с обработчиком: разворачивание обязано работать с
          клавиатуры и озвучиваться диктором, а `div` с `onClick` не делает ни того, ни другого.
        */}
        <UnstyledButton
          className={classes.header}
          onClick={onToggle}
          aria-expanded={open}
          aria-label={`${kind}: ${title || 'без названия'}`}
        >
          <Group gap={8} wrap="nowrap" align="center">
            {open ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            <div className={classes.text}>
              <Group gap={6} wrap="nowrap">
                <Text size="sm" fw={600} truncate>
                  {title || <Text component="span" c="dimmed" fw={400}>Без названия</Text>}
                </Text>
                {invalid && (
                  <IconAlertTriangle
                    size={13}
                    color="var(--mantine-color-orange-6)"
                    aria-label="В строке есть незаполненное поле"
                    style={{ flexShrink: 0 }}
                  />
                )}
              </Group>
              {summary && !open && (
                <Text size="xs" c="dimmed" truncate>
                  {summary}
                </Text>
              )}
            </div>
          </Group>
        </UnstyledButton>

        <ActionIcon color="red" variant="subtle" onClick={onRemove} radius="md" m="sm" aria-label={`Удалить ${kind.toLowerCase()}: ${title || 'без названия'}`}>
          <IconTrash size={16} />
        </ActionIcon>
      </Group>

      {/* Содержимое рисуется только открытым: спрятанное стилем стоило бы столько же, сколько
          показанное, а вся правка ради этого и затевалась. */}
      {open && <div className={classes.body}>{children}</div>}
    </Card>
  );
}
