import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import {
  Badge,
  Box,
  Collapse,
  Group,
  Loader,
  NavLink,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Typography,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

import { SafeHtml } from '../../components/common/SafeHtml';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { API_BASE_URL } from '../../lib/apiConfig';
import { HEADER_HEIGHT } from '../../layouts/shellMetrics';
import type { GuidelineDetails, GuidelineSection, GuidelineTocItem } from './types';
import classes from './GuidelineReader.module.css';

/**
 * Чтение клинической рекомендации: оглавление слева, текст справа.
 *
 * Оглавление здесь не украшение. Рекомендация — это в среднем двадцать семь разделов и под двести
 * тысяч знаков; без него врач, которому нужна «3.1 Консервативное лечение», листал бы туда
 * прокруткой мимо эпидемиологии и кодирования. Ровно так же устроены сами рекомендации на бумаге:
 * они начинаются с содержания.
 *
 * Разделы показываются **все сразу**, а не по одному: печать берёт то, что лежит в разметке, и
 * рекомендация, напечатанная одним открытым разделом, выглядела бы законченным документом. По той
 * же причине так сделаны длинные списки в картотеке.
 */

/** Ниже этого оглавление уезжает наверх: двум колонкам на телефоне не разойтись. */
const TWO_COLUMNS = '(min-width: 75em)';

/** Сколько длится свёртывание списка на телефоне. Знать это должны оба: и сам список, и переход. */
const COLLAPSE_MS = 200;

/**
 * Адрес рисунка внутри текста — относительный (`/api/clinical-guidelines/images/…`), и на боевом
 * сервере он верен: приложение и API живут на одном адресе. На стенде и в любой сборке, где API
 * стоит отдельно, такой путь ведёт в никуда, поэтому он приводится к настоящему основанию здесь, а
 * не запекается в базу: адрес API — свойство сборки, а текст рекомендации переживёт любой переезд.
 */
function withApiBase(html: string): string {
  return html.replaceAll('/api/clinical-guidelines/images/', `${API_BASE_URL}/clinical-guidelines/images/`);
}

interface GuidelineReaderProps {
  guideline: GuidelineDetails;
  sections: GuidelineSection[] | null;
  loading: boolean;
}

export function GuidelineReader({ guideline, sections, loading }: GuidelineReaderProps) {
  const wide = useMediaQuery(TWO_COLUMNS);
  const [active, setActive] = useState<string | null>(null);
  /* Свёрнутое оглавление — только для узкого экрана: в две колонки оно и так на виду. */
  const [opened, setOpened] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const tocViewport = useRef<HTMLDivElement>(null);

  /*
   * Оглавление берётся из текста, когда он приехал, и из сведений, пока едет: так список разделов
   * стоит на экране с первого кадра, а не появляется вместе с двумястами тысячами знаков.
   *
   * `level` у старых записей может не быть — до пересборки корпуса новыми правилами разбора. Тогда
   * оглавление плоское: это хуже вложенного, но лучше пустого места.
   */
  const toc = useMemo<GuidelineTocItem[]>(
    () =>
      (sections
        ? sections.map((section) => ({ anchor: section.anchor, title: section.title, level: section.level }))
        : guideline.toc
      ).map((item) => ({ ...item, level: item.level === 2 ? 2 : 1 })),
    [sections, guideline.toc],
  );

  /*
   * Какой раздел сейчас читают — по пересечению с верхней полосой экрана.
   *
   * Наблюдатель, а не замер на прокрутке: тот пересчитывал бы положение двух десятков заголовков на
   * каждый кадр, а здесь дерево на сотню тысяч узлов — ровно та ошибка, что стоила читалке книг
   * трёхсотмиллисекундных кадров.
   *
   * **Пересекающиеся разделы копятся в множестве, а не берутся из `entries`.** Наблюдатель зовёт
   * обработчик только с теми, у кого состояние *изменилось*: раздел, занявший весь экран, приходит
   * один раз и больше не появляется никогда. Считая по `entries`, мы бы подсвечивали последний
   * попавшийся, а на длинном разделе — вообще ничего.
   */
  useEffect(() => {
    if (!sections || sections.length === 0) return undefined;
    const nodes = [...(bodyRef.current?.querySelectorAll<HTMLElement>('[data-section]') ?? [])];
    if (nodes.length === 0) return undefined;

    const order = new Map(nodes.map((node, index) => [node.dataset.section!, index]));
    const seen = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const anchor = (entry.target as HTMLElement).dataset.section!;
          if (entry.isIntersecting) seen.add(anchor);
          else seen.delete(anchor);
        }
        const first = [...seen].sort((a, b) => order.get(a)! - order.get(b)!)[0];
        if (first) setActive(first);
      },
      { rootMargin: `-${HEADER_HEIGHT + 8}px 0px -70% 0px` },
    );
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sections]);

  /*
   * Переход к разделу — `scrollIntoView`, а не `window.scrollTo`, и это исправленная ошибка.
   *
   * **Окно в этом приложении не прокручивается никогда:** в режиме `static` прокручивается корень
   * оболочки, а шапка и сайдбар прилипают внутри него (см. `scrollRoot.ts`). `window.scrollTo`
   * поэтому не делал ровно ничего — оглавление подсвечивало текущий раздел, реагировало на нажатие
   * и никуда не вело. `scrollIntoView` двигает того предка, который на самом деле прокручивается,
   * какой бы он ни был, а отступ на шапку берёт на себя `scroll-margin-top` у самого раздела.
   */
  const goTo = (anchor: string) => {
    document.getElementById(`section-${anchor}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  /*
   * Текущий раздел подтягивается в видимую часть оглавления.
   *
   * Разделов двадцать восемь, а рамка оглавления показывает от силы четырнадцать: замер на
   * «Аллергическом рините» — дочитав до «3. Лечение», врач видит в списке пункты 1.1–2.5 и ни одной
   * отметки. Оглавление в этот момент перестаёт отвечать на вопрос «где я», ради которого подсветка
   * и заведена.
   *
   * Двигается **только когда пункт не виден**, и не `scrollIntoView`: тот прокручивает всех предков
   * разом и утащил бы за собой саму страницу — то есть подсветка, следящая за листанием, начала бы
   * листать в ответ. Здесь трогается ровно одна коробка, и только по своей оси.
   */
  useEffect(() => {
    const viewport = tocViewport.current;
    if (!active || !viewport) return;
    const item = viewport.querySelector<HTMLElement>(`[data-toc="${CSS.escape(active)}"]`);
    if (!item) return;

    const box = viewport.getBoundingClientRect();
    const row = item.getBoundingClientRect();
    // Запас в строку: пункт, севший вплотную к краю, читается как последний в списке.
    const margin = row.height;
    if (row.top < box.top + margin) viewport.scrollTop -= box.top + margin - row.top;
    else if (row.bottom > box.bottom - margin) viewport.scrollTop += row.bottom - (box.bottom - margin);
  }, [active]);

  /*
   * Переход из свёрнутого списка: сначала закрыть, и только потом вести.
   *
   * Порядок здесь несущий. Список на телефоне — это полторы тысячи пикселей **над** документом, и
   * закрывается он с анимацией. Прокрутка, начатая раньше, целится в место, которое ещё едет:
   * плавная прокрутка вычисляет цель один раз, на старте, а высота страницы после этого падает на
   * высоту списка — раздел, к которому перешли, оказывался на 1051 px выше края экрана (замер по
   * кадрам: цель посчитана при `scrollHeight` 133 093, а к концу свёртывания стало 131 957).
   *
   * Дожидаться по таймеру бесполезно — это то же гадание другими словами; поэтому ведём по концу
   * самого перехода, когда высота уже окончательная.
   */
  const pending = useRef<string | null>(null);

  const goToFromList = (anchor: string) => {
    if (wide || !opened) {
      goTo(anchor);
      return;
    }
    pending.current = anchor;
    setOpened(false);
  };

  const afterCollapse = () => {
    const anchor = pending.current;
    pending.current = null;
    if (anchor) goTo(anchor);
  };

  const items = (
    <Stack gap={2}>
      {toc.map((item) => (
        <NavLink
          key={item.anchor}
          data-toc={item.anchor}
          label={item.title}
          active={active === item.anchor}
          onClick={() => goToFromList(item.anchor)}
          /*
           * Подраздел сдвинут, и это не отступ ради красоты: «1.1 Определение» без «1. Краткой
           * информации» над собой — пункт, висящий сам по себе, и оглавление перестаёт показывать
           * устройство документа, ради которого его и читают.
           */
          pl={item.level === 2 ? 26 : undefined}
          styles={{
            label: {
              fontSize: 13,
              whiteSpace: 'normal',
              fontWeight: item.level === 1 ? 600 : 400,
            },
          }}
        />
      ))}
    </Stack>
  );

  const header = (
    <>
      <Title order={2} mb={4}>
        {guideline.name}
      </Title>
      <Group gap={6} mb="xs" wrap="wrap">
        {guideline.mkbCodes.map((code) => (
          <Badge key={code} size="sm" variant="light" color="gray">
            {code}
          </Badge>
        ))}
        {guideline.ageGroup && (
          <Badge size="sm" variant="light" color="blue">
            {guideline.ageGroup}
          </Badge>
        )}
      </Group>
      {/*
        Разработчик и дата размещения — то немногое, что об этом документе можно сказать честно.
        Автора и «дату правки» здесь не бывает: документ не наш, а дата в базе — это день, когда
        его привезла синхронизация.
      */}
      <Text size="xs" c="dimmed" mb="lg">
        {guideline.developers.join(', ') || 'Минздрав России'}
        {guideline.publishDate ? ` · размещена ${guideline.publishDate.slice(0, 10).split('-').reverse().join('.')}` : ''}
      </Text>
    </>
  );

  return (
    <Group align="flex-start" gap="lg" wrap="nowrap" style={{ flexDirection: wide ? 'row' : 'column' }}>
      {wide ? (
        /*
         * Оглавление прилипает под шапкой — как панель редактора, и к той же переменной. Класс
         * `app-sticky` обязателен: им объявляется, что состояние шапки этот блок касается, и без
         * него оглавление осталось бы висеть там, где шапки уже нет.
         *
         * На бумагу оно не идёт: у напечатанного документа своё содержание, а список ссылок, по
         * которым нельзя нажать, — мусор над первым разделом.
         */
        <Paper
          withBorder
          radius="md"
          p="sm"
          className="app-sticky no-print"
          style={{ top: 'var(--app-sticky-top)', position: 'sticky', width: 320, flexShrink: 0 }}
        >
          <ScrollArea.Autosize viewportRef={tocViewport} mah="calc(100vh - var(--app-sticky-top) - 48px)">
            <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
              Содержание
            </Text>
            {items}
          </ScrollArea.Autosize>
        </Paper>
      ) : (
        /*
         * На узком экране оглавление свёрнуто, и это не мелочь: двадцать восемь строк — это целый
         * экран с лишним (замер на 390: до первой строки документа 1100 px). Врач открывает
         * рекомендацию, чтобы читать её, а не список её разделов; тому, кому нужен раздел, он
         * разворачивается одним нажатием и закрывается сам, как только по нему перешли.
         */
        <Paper withBorder radius="md" w="100%" className="no-print">
          <UnstyledButton
            onClick={() => setOpened((was) => !was)}
            p="sm"
            w="100%"
            aria-expanded={opened}
            aria-label="Содержание рекомендации"
          >
            <Group justify="space-between" wrap="nowrap">
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                Содержание · {toc.length}
              </Text>
              <IconChevronDown
                size={16}
                style={{ transform: opened ? 'rotate(180deg)' : undefined, transition: 'transform 150ms' }}
              />
            </Group>
          </UnstyledButton>
          <Collapse expanded={opened} transitionDuration={COLLAPSE_MS} onTransitionEnd={afterCollapse}>
            <Box px="sm" pb="sm">
              {items}
            </Box>
          </Collapse>
        </Paper>
      )}

      {/*
        Текст лежит на подложке, а оглавление — нет, и это то же правило, по которому снаружи
        подложки остаются только действия над документом. Оглавление — навигация по документу, а не
        его часть: на бумаге его нет, и прилипать оно обязано к экрану, а не к листу.
      */}
      {/*
        Ширина колонки задаётся явно, и это не перестраховка. Сложившись в столбик, `Group` с
        `align="flex-start"` ужимает детей по содержимому — а подложка на телефоне уходит за края
        экрана отрицательным отступом на `--app-shell-padding` и считает его от своей колонки.
        Замер на 390: подложка 417 px при экране 390, то есть корень оболочки ездил вбок на 27.
      */}
      <Box style={{ flex: 1, minWidth: 0, width: wide ? undefined : '100%' }}>
        <ReadingSheet>
          <Box ref={bodyRef}>
            {header}

            {loading || !sections ? (
              <Group justify="center" py="xl">
                <Loader size="sm" />
              </Group>
            ) : (
              <Stack gap="xl">
                {sections.map((section) => (
                  <Box
                    key={section.anchor}
                    id={`section-${section.anchor}`}
                    data-section={section.anchor}
                    className={classes.section}
                  >
                    {/*
                      Заголовок по уровню раздела: «2. Диагностика» крупнее, чем «2.4
                      Инструментальные исследования». Плоский набор одинаковых заголовков читается
                      как двадцать семь равноправных документов подряд, а не как один документ.
                    */}
                    <Title order={section.level === 2 ? 4 : 3} size={section.level === 2 ? 'h5' : 'h4'} mb="xs">
                      {section.title}
                    </Title>
                    {/*
                      У заголовка группы своего текста не бывает — весь он в подразделах. Пустой
                      `Typography` рисовал бы под ним лишний отступ.
                    */}
                    {section.html && (
                      <Typography className={classes.text}>
                        <SafeHtml html={withApiBase(section.html)} />
                      </Typography>
                    )}
                  </Box>
                ))}
              </Stack>
            )}
          </Box>
        </ReadingSheet>
      </Box>
    </Group>
  );
}
