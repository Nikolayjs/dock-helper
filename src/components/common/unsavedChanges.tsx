import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Group, Modal, Text } from '@mantine/core';
import { useBlocker } from 'react-router-dom';
import type { Editor } from '@tiptap/react';

/**
 * Предупреждение о несохранённых изменениях: одно на все редакторы.
 *
 * Уйти из редактора можно тремя дорогами, и каждую приходится перекрывать по-своему: ссылкой внутри
 * приложения и кнопкой «назад» браузера (обе ловит `useBlocker` — ради него роутер и переехал на
 * `createBrowserRouter`) и закрытием вкладки или перезагрузкой (`beforeunload`, где вопрос задаёт
 * сам браузер и оформить его по-своему нельзя).
 *
 * Своё окно нужно ровно ради третьей кнопки. Браузерное умеет только «уйти» и «остаться»; врач,
 * которого спросили о несохранённой работе, чаще всего хочет её **сохранить**, и выбор между
 * потерей и возвращением заставлял бы делать этот шаг руками.
 */

/** Сравнение с ранним выходом по ссылке: неизменённое поддерево сравнивается за одно сравнение. */
function isEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => isEqual(item, b[index]));
  }
  if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
    const left = a as Record<string, unknown>;
    const right = b as Record<string, unknown>;
    const keys = Object.keys(left);
    return keys.length === Object.keys(right).length && keys.every((key) => isEqual(left[key], right[key]));
  }
  return false;
}

/**
 * Изменилась ли форма с того вида, в каком открылась.
 *
 * Сравнивается то самое значение, которое уходит в сохранение, — иначе «изменения есть» и «есть что
 * сохранять» разошлись бы, и окно всплывало бы там, где сохранять нечего.
 *
 * `ready` — для форм, которые заполняются не сразу: конструкторы калькуляторов, анкет, анализаторов
 * и карточка препарата стартуют пустыми и переносят в себя запись, когда та придёт с сервера. Снять
 * снимок раньше — значит принять это заполнение за правку врача и спрашивать о несохранённом там,
 * где он ничего не трогал.
 */
export function useDirtyValue(value: unknown, ready = true): boolean {
  // Снимок и есть «как было при открытии»: берётся один раз и потом только читается.
  const [initial, setInitial] = useState<{ value: unknown } | null>(ready ? { value } : null);

  useEffect(() => {
    // `value` здесь — из того рендера, в котором форма заполнилась; ровно он и нужен.
    if (ready && !initial) setInitial({ value });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- снимок берётся один раз, по готовности
  }, [ready, initial]);

  return initial ? !isEqual(initial.value, value) : false;
}

/**
 * Правил ли врач текст.
 *
 * Tiptap держит документ у себя, и его содержимое не проходит через состояние формы: сравнивать
 * нечего, зато есть событие. `content` задаётся один раз, при создании редактора, поэтому `update`
 * приходит только от настоящей правки — включая вставку из Word, которая правка и есть.
 */
export function useEditorDirty(editor: Editor | null): boolean {
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!editor) return;
    const mark = () => setDirty(true);
    editor.on('update', mark);
    return () => {
      editor.off('update', mark);
    };
  }, [editor]);

  return dirty;
}

/** Сколько времени длится разрешение уйти, выданное сохранением. */
const RELEASE_MS = 10_000;

export interface UnsavedGuard {
  /** Вызывается формой перед сохранением: переход, который сделает сохранение, задерживать не надо. */
  release: () => void;
  /** Окно вопроса. `onSave` не передан — значит сохранить нечем, и кнопки не будет. */
  render: (options?: { onSave?: () => void }) => ReactNode;
}

export function useUnsavedGuard(dirty: boolean): UnsavedGuard {
  /**
   * Разрешение действует **на один переход и не дольше десяти секунд**.
   *
   * Одного флага мало в обе стороны. Не гасить его вовсе — и сорвавшееся сохранение (сеть, отказ
   * сервера) навсегда снимало бы охрану с формы, в которой всё осталось несохранённым. Гасить сразу
   * по таймеру нельзя тоже: страница сохраняет и уходит уже после `await`, а не в том же кадре.
   */
  const releasedUntil = useRef(0);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (Date.now() < releasedUntil.current) {
      releasedUntil.current = 0;
      return false;
    }
    return dirty && currentLocation.pathname !== nextLocation.pathname;
  });

  const release = useCallback(() => {
    releasedUntil.current = Date.now() + RELEASE_MS;
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      // Текст задаёт браузер, а не мы: своё сообщение здесь не показывают уже много лет.
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const render = (options?: { onSave?: () => void }) => (
    <Modal
      opened={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title="Изменения не сохранены"
      centered
    >
      <Text size="sm">
        {options?.onSave
          ? 'Вы что-то поменяли и ещё не сохранили. Сохранить перед уходом?'
          : 'Вы что-то поменяли и ещё не сохранили. Уйти сейчас — значит потерять правки; чтобы сохранить, вернитесь и заполните обязательные поля.'}
      </Text>
      <Group justify="flex-end" mt="lg" gap="xs">
        <Button variant="subtle" onClick={() => blocker.reset?.()}>
          Остаться
        </Button>
        <Button variant="default" color="red" onClick={() => blocker.proceed?.()}>
          Уйти без сохранения
        </Button>
        {options?.onSave && (
          <Button
            onClick={() => {
              // Уводит со страницы само сохранение: оно знает, куда возвращаться после записи — к
              // документу, к списку, к карточке пациента. Свой переход здесь бы с ним спорил.
              blocker.reset?.();
              options.onSave?.();
            }}
          >
            Сохранить
          </Button>
        )}
      </Group>
    </Modal>
  );

  return { release, render };
}
