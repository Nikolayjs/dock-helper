import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createHttpRepository } from './httpRepository';
import type { HttpRepository } from './httpRepository';

/**
 * Один скелет списка вместо шестнадцати копий.
 *
 * Экономия строк тут вторична. Первично то, что **любое системное улучшение приходилось вносить в
 * шестнадцать мест** — и оно уже начало расходиться: показ ошибки загрузки пришлось разносить
 * руками по двенадцати хукам, `useDrugs` инвалидировал умнее остальных, а `useCalculators`
 * единственный обновлял строку в кэше вместо перезагрузки списка. Следующее улучшение —
 * оптимистичные правки, свой `staleTime` — теперь пишется здесь один раз.
 *
 * Ресурс объявляется рядом со своей фичей и остаётся **данными**: `queryKey` и путь. Хук
 * `useCrudResource` — единственное место, где они превращаются в запросы, поэтому объявление можно
 * импортировать откуда угодно, не втягивая за собой React Query.
 */
export interface CrudResource<T, TCreate, TUpdate = Partial<TCreate>> {
  queryKey: readonly unknown[];
  repo: HttpRepository<T, TCreate, TUpdate>;
  /**
   * Кэши, которые тоже устаревают от правки.
   *
   * Карточка препарата живёт в своём кэше (`['drug', id]`), а не только строкой в списке: правка,
   * обновившая список и не обновившая карточку, показала бы врачу старый текст сразу после
   * сохранения.
   */
  alsoInvalidate?: readonly (readonly unknown[])[];
}

export function createCrudResource<T, TCreate, TUpdate = Partial<TCreate>>(
  resourcePath: string,
  queryKey: readonly unknown[],
  options: { alsoInvalidate?: readonly (readonly unknown[])[] } = {},
): CrudResource<T, TCreate, TUpdate> {
  return {
    queryKey,
    repo: createHttpRepository<T, TCreate, TUpdate>(resourcePath),
    alsoInvalidate: options.alsoInvalidate,
  };
}

export interface CrudHandle<T, TCreate, TUpdate = Partial<TCreate>> {
  items: T[];
  /** Данных ещё не было ни разу. Не то же, что «запрос сейчас идёт» — см. `isPending` в реализации. */
  isLoading: boolean;
  /**
   * Список действительно пришёл.
   *
   * Это не то же, что «загрузка кончилась»: она кончается и при ошибке, и пустой список тогда
   * значит «не спросили», а не «нечего показывать». На этом различии однажды погорел засев лент по
   * умолчанию — он завёл дубликаты всех шести.
   */
  isSuccess: boolean;
  error: unknown;
  /**
   * Перезагрузить список и дождаться свежих данных.
   *
   * Отдаёт сами записи, а не «void»: тому, кто собирает PATCH из чужой записи, нужен не сигнал, а
   * то, что сейчас на сервере. Иначе правка, сделанная в другой вкладке, затирается копией из
   * кэша — а кэш здесь живёт долго (`refetchOnWindowFocus: false`).
   */
  refetch: () => Promise<T[]>;
  /** Пометить список устаревшим. Нужен хукам, которые достраивают свои мутации поверх базовых. */
  invalidate: () => void;
  create: (input: TCreate) => Promise<T>;
  update: (id: string, input: TUpdate) => Promise<T>;
  remove: (id: string) => Promise<void>;
  /**
   * Заменить одну строку в кэше, не перезагружая список.
   *
   * Для действий, которые меняют ровно одну строку и жмутся часто: звёздочка калькулятора стоит на
   * списке из тридцати карточек, и перезагружать его ради галочки незачем.
   */
  replaceInCache: (row: T & { id: string }) => void;
  /**
   * Оптимистичная правка одной строки: экран меняется в том же кадре, сервер догоняет.
   *
   * Отметка в чек-листе — действие, у которого нет «в процессе»: галочка либо стоит, либо нет.
   * Через ручку сервера и перезагрузку списка она появлялась только после круга по сети, а список
   * заметок везёт с собой их тексты вместе с картинками — на телефоне это была та самая «огромная
   * задержка» на каждое нажатие.
   *
   * Ответ сервера **заменяет** предположение (`replaceInCache`), а ошибка возвращает список таким,
   * каким он был: соврать про сохранённую отметку хуже, чем показать её с задержкой.
   */
  optimisticUpdate: <R extends T & { id: string }>(
    id: string,
    patch: (row: T) => T,
    run: () => Promise<R>,
  ) => Promise<R>;
}

export function useCrudResource<T, TCreate, TUpdate = Partial<TCreate>>(
  resource: CrudResource<T, TCreate, TUpdate>,
): CrudHandle<T, TCreate, TUpdate> {
  const { queryKey, repo, alsoInvalidate } = resource;
  const queryClient = useQueryClient();
  // `isPending`, а не `isLoading`, и это не придирка к именам. `isLoading` у React Query — это
  // «первый запрос **в полёте**», и между монтированием наблюдателя и стартом запроса есть кадр,
  // где данных ещё нет, а `isLoading` уже false. Ровно в этот кадр редактор успевал показать
  // «Пациент не найден» (замер: одно появление на 426 мс после открытия по прямой ссылке).
  // `isPending` отвечает на честный вопрос: «данные уже приходили?»
  const { data: items = [], isPending, isSuccess, error, refetch } = useQuery({ queryKey, queryFn: repo.list });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
    for (const key of alsoInvalidate ?? []) queryClient.invalidateQueries({ queryKey: key });
  };

  const createMutation = useMutation({ mutationFn: (input: TCreate) => repo.create(input), onSuccess: invalidate });
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TUpdate }) => repo.update(id, input),
    onSuccess: invalidate,
  });
  const removeMutation = useMutation({ mutationFn: (id: string) => repo.remove(id), onSuccess: invalidate });

  const replaceInCache = (row: T & { id: string }) => {
    queryClient.setQueryData<T[]>(queryKey, (prev) =>
      prev?.map((item) => ((item as { id?: string }).id === row.id ? row : item)) ?? prev,
    );
  };

  return {
    items,
    isLoading: isPending,
    isSuccess,
    error,
    refetch: async () => (await refetch()).data ?? items,
    invalidate,
    create: createMutation.mutateAsync,
    update: (id, input) => updateMutation.mutateAsync({ id, input }),
    remove: removeMutation.mutateAsync,
    replaceInCache,
    optimisticUpdate: async (id, patch, run) => {
      // Запрос списка, начатый до правки, пришёл бы с прежним значением и затёр бы её.
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<T[]>(queryKey);
      queryClient.setQueryData<T[]>(queryKey, (prev) =>
        prev?.map((item) => ((item as { id?: string }).id === id ? patch(item) : item)) ?? prev,
      );
      try {
        const saved = await run();
        replaceInCache(saved);
        return saved;
      } catch (error) {
        if (previous) queryClient.setQueryData<T[]>(queryKey, previous);
        throw error;
      }
    },
  };
}

/**
 * Мутация, которая после успеха помечает список устаревшим.
 *
 * У половины хуков сверх обычного CRUD есть свои ручки: визиты пациента, наблюдения диспансерного
 * учёта, переключение пункта чек-листа, отметка о показе напоминания. Каждая из них была четырьмя
 * строками `useMutation` с одинаковым `onSuccess: invalidate` и объектом-обёрткой вокруг
 * аргументов — обёрткой, нужной только потому, что `mutationFn` принимает ровно один параметр.
 *
 * Здесь аргументы едут кортежем, поэтому наружу функция выглядит обычной: `addVisit(id, input)`.
 */
export function useInvalidatingMutation<TArgs extends unknown[], TResult>(
  invalidate: () => void,
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  const mutation = useMutation({ mutationFn: (args: TArgs) => fn(...args), onSuccess: invalidate });
  return (...args: TArgs) => mutation.mutateAsync(args);
}
