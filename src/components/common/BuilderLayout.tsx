import type { ReactNode } from 'react';
import { Grid, Stack, Tabs } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';

import classes from './BuilderLayout.module.css';

/**
 * Раскладка конструктора: слева форма, справа предпросмотр — а на телефоне вкладки.
 *
 * Одинаково устроены три конструктора: анализатора, калькулятора и анкеты. На широком экране
 * предпросмотр стоит рядом и виден всё время. На узком колонки складываются друг под друга, и
 * предпросмотр оказывается **в конце страницы** — у анализа из тридцати показателей это тридцать
 * тысяч пикселей прокрутки, то есть инструмент, которым с телефона не пользуются вовсе.
 *
 * Поэтому ниже `lg` те же две части показываются вкладками, а полоса вкладок прилипает под шапкой:
 * предпросмотр всегда в одном нажатии.
 *
 * **Кнопки формы стоят снаружи вкладок.** Внутри они уехали бы вместе со своей вкладкой, и
 * «Сохранить» пропадало бы ровно тогда, когда врач проверил результат в предпросмотре и хочет его
 * записать.
 */
interface BuilderLayoutProps {
  /** Карточки формы: то, что врач правит. */
  editor: ReactNode;
  /** Панель действий (`FormActions`) — видна на обеих вкладках. */
  actions: ReactNode;
  preview: ReactNode;
  /** Подпись вкладки предпросмотра: у анкеты это «Предпросмотр опроса». */
  previewLabel?: string;
}

export function BuilderLayout({ editor, actions, preview, previewLabel = 'Предпросмотр' }: BuilderLayoutProps) {
  // Тот же порог, что у сетки ниже: раскладка и вкладки обязаны переключаться в одной точке.
  const sideBySide = useMediaQuery('(min-width: 75em)', true, { getInitialValueInEffect: false });

  if (sideBySide) {
    return (
      <Grid gap="xl">
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Stack gap="lg">
            {editor}
            {actions}
          </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 5 }}>{preview}</Grid.Col>
      </Grid>
    );
  }

  return (
    <>
      <Tabs defaultValue="editor" variant="pills" keepMounted={false}>
        <div className={classes.tabs}>
          <Tabs.List>
            <Tabs.Tab value="editor">Конструктор</Tabs.Tab>
            <Tabs.Tab value="preview">{previewLabel}</Tabs.Tab>
          </Tabs.List>
        </div>

        {/*
          Вкладка рисуется только когда открыта (`keepMounted={false}`): предпросмотр анализа — это
          три десятка полей, и держать их отрисованными за кадром значило бы платить за них на каждое
          нажатие в форме. Введённое при этом не теряется: и правки, и значения предпросмотра живут
          в состоянии страницы, а не внутри вкладки.
        */}
        <Tabs.Panel value="editor">
          <Stack gap="lg">{editor}</Stack>
        </Tabs.Panel>
        <Tabs.Panel value="preview">{preview}</Tabs.Panel>
      </Tabs>
      {actions}
    </>
  );
}
