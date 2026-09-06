import { useMemo } from 'react';
import { Accordion, Badge, Group, Stack, Text } from '@mantine/core';

import { InlineBold } from '../../components/common/InlineBold';

import type { Locus, MicrobiologyReference, Organism } from './types';

/**
 * Что вообще растёт в этом материале и что это значит.
 *
 * **Это ответ на бланк, а не украшение.** Посев из зева приходит списком в полтора десятка строк,
 * каждая помечена «условно-патогенная флора», и начинающий врач по этой пометке назначает
 * антибиотик — потому что понять, кто из них меняет тактику, по самому бланку нечем, а написано об
 * этом мало. Здесь список разложен по ролям: кто меняет тактику, кто живёт тут всегда и кто попал
 * при заборе.
 *
 * Свёрнуто по умолчанию: врачу, который уже знает свой материал, эти двадцать строк каждый раз
 * листать незачем, а разбор конкретного бланка должен стоять выше справки о материале вообще.
 */
interface LocusFloraGuideProps {
  reference: MicrobiologyReference;
  locus: Locus;
}

interface Section {
  key: string;
  title: string;
  hint: string;
  color: string;
  organisms: Organism[];
}

export function LocusFloraGuide({ reference, locus }: LocusFloraGuideProps) {
  const byKey = useMemo(() => new Map(reference.organisms.map((o) => [o.key, o])), [reference.organisms]);
  const resolve = (keys: string[] | undefined) =>
    (keys ?? []).map((key) => byKey.get(key)).filter((o): o is Organism => o !== undefined);

  const sections: Section[] = useMemo(() => {
    const list: Section[] = [
      {
        key: 'pathogens',
        title: 'Меняют тактику',
        hint: 'Значимы при любом росте, включая скудный: в норме их здесь не бывает.',
        color: 'red',
        organisms: resolve(locus.pathogens),
      },
      {
        key: 'flora',
        title: 'Живут здесь всегда',
        hint: 'Рост сам по себе не диагноз и «санации» не требует: после курса антибиотика они вырастут снова, а взамен появится устойчивая флора.',
        color: 'teal',
        organisms: resolve(locus.flora),
      },
      {
        key: 'contaminants',
        title: 'Обычно попадают при заборе',
        hint: 'Не из очага, а с кожи или из соседнего места. Прежде чем лечить, стоит пересдать анализ с соблюдением техники.',
        color: 'gray',
        organisms: resolve(locus.contaminants),
      },
    ];
    return list.filter((section) => section.organisms.length > 0);
    // resolve замыкает byKey и locus — обе зависимости названы; своей ссылки у неё нет намеренно.
  }, [byKey, locus]);

  const total = sections.reduce((sum, section) => sum + section.organisms.length, 0);
  if (total === 0) return null;

  return (
    <Accordion variant="contained" chevronPosition="left">
      <Accordion.Item value="guide">
        <Accordion.Control>
          <Text size="sm" fw={500}>
            Что растёт в этом материале и что это значит — {total}
          </Text>
        </Accordion.Control>
        <Accordion.Panel>
          <Stack gap="md">
            {sections.map((section) => (
              <Stack key={section.key} gap={6}>
                <Group gap={8} wrap="nowrap" align="center">
                  <Badge color={section.color} variant="light">
                    {section.title}
                  </Badge>
                  <Text size="xs" c="dimmed">
                    {section.organisms.length}
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  {section.hint}
                </Text>
                <Stack gap={8}>
                  {section.organisms.map((organism) => (
                    <div key={organism.key}>
                      <Text size="sm" fw={600}>
                        {organism.ru}{' '}
                        <Text span size="xs" c="dimmed" fs="italic">
                          {organism.name}
                        </Text>
                      </Text>
                      <Text size="xs" c="dimmed">
                        <InlineBold text={organism.note} />
                      </Text>
                    </div>
                  ))}
                </Stack>
              </Stack>
            ))}
          </Stack>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
}
