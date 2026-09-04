import { useEffect, useMemo, useRef, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { Badge, Box, Group, Loader, NavLink, Paper, ScrollArea, Stack, Text, Title, Typography } from '@mantine/core';

import { SafeHtml } from '../../components/common/SafeHtml';
import { API_BASE_URL } from '../../lib/apiConfig';
import { HEADER_HEIGHT } from '../../layouts/shellMetrics';
import type { GuidelineDetails, GuidelineSection } from './types';

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
  const bodyRef = useRef<HTMLDivElement>(null);

  const toc = useMemo(
    () => (sections ? sections.map((section) => ({ anchor: section.anchor, title: section.title })) : guideline.toc),
    [sections, guideline.toc],
  );

  /*
   * Какой раздел сейчас читают — по пересечению с верхом окна.
   *
   * Наблюдатель, а не замер на прокрутке: тот пересчитывал бы положение двух десятков заголовков на
   * каждый кадр, а здесь дерево на сотню тысяч узлов — ровно та ошибка, что стоила читалке книг
   * трёхсотмиллисекундных кадров.
   */
  useEffect(() => {
    if (!sections || sections.length === 0) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id.replace('section-', ''));
      },
      { rootMargin: `-${HEADER_HEIGHT + 8}px 0px -70% 0px` },
    );
    for (const node of bodyRef.current?.querySelectorAll('[data-section]') ?? []) observer.observe(node);
    return () => observer.disconnect();
  }, [sections]);

  const goTo = (anchor: string) => {
    const node = document.getElementById(`section-${anchor}`);
    if (!node) return;
    // Отступ на шапку: без него заголовок раздела встаёт ровно под ней и выглядит пропущенным.
    window.scrollTo({ top: node.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 12, behavior: 'smooth' });
  };

  const contents = (
    <Stack gap={2}>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
        Содержание
      </Text>
      {toc.map((item) => (
        <NavLink
          key={item.anchor}
          label={item.title}
          active={active === item.anchor}
          onClick={() => goTo(item.anchor)}
          styles={{ label: { fontSize: 13, whiteSpace: 'normal' } }}
        />
      ))}
    </Stack>
  );

  return (
    <Group align="flex-start" gap="lg" wrap="nowrap" style={{ flexDirection: wide ? 'row' : 'column' }}>
      {wide ? (
        /* Оглавление прилипает под шапкой — как панель редактора, и к той же переменной. */
        <Paper
          withBorder
          radius="md"
          p="sm"
          className="app-sticky"
          style={{ top: 'var(--app-sticky-top)', position: 'sticky', width: 320, flexShrink: 0 }}
        >
          <ScrollArea.Autosize mah="calc(100vh - var(--app-sticky-top) - 48px)">{contents}</ScrollArea.Autosize>
        </Paper>
      ) : (
        <Paper withBorder radius="md" p="sm" w="100%">
          {contents}
        </Paper>
      )}

      <Box style={{ flex: 1, minWidth: 0 }} ref={bodyRef}>
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

        {loading || !sections ? (
          <Group justify="center" py="xl">
            <Loader size="sm" />
          </Group>
        ) : (
          <Stack gap="xl">
            {sections.map((section) => (
              <Box key={section.anchor} id={`section-${section.anchor}`} data-section={section.anchor}>
                <Title order={3} size="h4" mb="xs">
                  {section.title}
                </Title>
                <Typography>
                  <SafeHtml html={withApiBase(section.html)} />
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </Group>
  );
}
