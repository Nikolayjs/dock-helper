import { Button, Center, Container, Loader, Stack, Text, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { PageToolbar } from './PageToolbar';

/**
 * Каркас страницы-редактора: кнопка «Назад», заголовок, подложка с формой.
 *
 * Пять редакторов повторяли его слово в слово, и правка уже разошлась. **«Не найдено» до того, как
 * список пришёл, — это враньё, и оно мигало на каждом открытии по прямой ссылке**: врач, перешедший
 * по ссылке на пациента или нажавший F5, видел «Пациент не найден», которое через долю секунды
 * сменялось формой. В документах врача это когда-то починили отдельной строкой с комментарием, а в
 * пациентах, картах учёта и заметках — нет.
 *
 * Пока список едет, страница пуста. Пустота на четверть секунды честнее сообщения, которое
 * опровергнет само себя: скелетон формы здесь тоже был бы обещанием, что запись существует.
 */
interface RecordEditorPageProps {
  /** `id` из адреса. Пусто — создаётся новая запись, и «не найдено» невозможно по определению. */
  id: string | undefined;
  /** Найденная запись. `undefined` значит и «не нашли», и «список ещё не пришёл» — их различает `isLoading`. */
  record: unknown;
  /** Список, в котором ищется запись, ещё загружается. */
  isLoading: boolean;
  /** Тело записи догружается отдельным запросом (база знаний отдаёт список без текстов). */
  bodyLoading?: boolean;
  notFound: { text: string; to: string; label: string };
  /** Кнопка «Назад»: у одних страниц она помнит происхождение, у других ведёт в свой раздел. */
  back: ReactNode;
  title: string;
  subtitle?: ReactNode;
  /** Ширина колонки. Таблице нужна вся, тексту — читаемая. */
  size?: string;
  children: ReactNode;
}

export function RecordEditorPage({
  id,
  record,
  isLoading,
  bodyLoading = false,
  notFound,
  back,
  title,
  subtitle,
  size = 'md',
  children,
}: RecordEditorPageProps) {
  if (id && !record) {
    if (isLoading) return null;
    return (
      <Container size={size} px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>{notFound.text}</Text>
          <Button component={Link} to={notFound.to} mt="md">
            {notFound.label}
          </Button>
        </Stack>
      </Container>
    );
  }

  if (id && bodyLoading) {
    return (
      <Container size={size} px={0}>
        <Center py={100}>
          <Loader size="sm" />
        </Center>
      </Container>
    );
  }

  return (
    <Container size={size} px={0}>
      <Stack gap="lg">
        {/*
          Возврат и заголовок — на поверхности, а не на фоне страницы: одно правило на всё
          приложение, см. `PageToolbar`. Здесь оно закрывает сразу все редакторы: пациента, заметку,
          документ, статью, рекомендацию, болезнь и карту учёта — раньше у каждого «Назад» висел на
          обоях.
        */}
        <PageToolbar>
          <Stack gap="sm">
            {back}
            {subtitle ? (
              <div>
                <Title order={3}>{title}</Title>
                {subtitle}
              </div>
            ) : (
              <Title order={3}>{title}</Title>
            )}
          </Stack>
        </PageToolbar>
        {children}
      </Stack>
    </Container>
  );
}
