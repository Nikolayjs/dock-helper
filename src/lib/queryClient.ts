import { MutationCache, QueryClient } from '@tanstack/react-query';
import { notifications } from '@mantine/notifications';

/**
 * Ошибка любой мутации показывается врачу — по умолчанию и для всех сразу.
 *
 * До этого формы отдавали `onSubmit` без `try/catch`, и при недоступном сервере получалось худшее из
 * возможного: необработанное отклонение в консоли, ни тоста, ни перехода, и снятая охрана от ухода
 * со страницы. Врач жал «Сохранить», не происходило ничего, он уходил — приём потерян.
 *
 * Обработчик стоит в кэше мутаций, а не в каждом вызове: так он покрывает и те мутации, которые
 * появятся позже. Свой `onError` у конкретной мутации его не отменяет — оба вызываются, и
 * специальное сообщение всегда можно добавить рядом.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
  mutationCache: new MutationCache({
    onError: (error) => {
      notifications.show({
        color: 'red',
        title: 'Не удалось сохранить',
        message: error instanceof Error ? error.message : 'Неизвестная ошибка.',
      });
    },
  }),
});
