import { Group, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconFileText, IconPhotoScan } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import type { DocumentTemplate } from '../patients/documents/templateTypes';
import type { RankedTemplate } from './documentUsage';
import linkClasses from './dashboardLinks.module.css';

/**
 * The blanks this doctor actually prints, most used first.
 *
 * Each row goes to `?use=<id>`, which opens the patient picker straight away — the point of a
 * shortcut is to save the two steps, not to name them.
 */
interface FrequentDocumentsProps {
  ranked: RankedTemplate[];
  templatesById: Map<string, DocumentTemplate>;
}

function timesLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} раз`;
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return `${count} раза`;
  return `${count} раз`;
}

export function FrequentDocuments({ ranked, templatesById }: FrequentDocumentsProps) {
  if (ranked.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Пока пусто. Отсюда можно будет печатать бланки в один клик — список соберётся сам, как только вы
        напечатаете первые документы.
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {ranked.map((entry) => {
        const template = templatesById.get(entry.id);
        if (!template) return null;
        const isScan = template.kind === 'layout';

        return (
          <Link
            key={entry.id}
            to={`/documents?tab=templates&use=${entry.id}`}
            className={linkClasses.row}
          >
            <Group gap={8} wrap="nowrap" align="flex-start">
              <ThemeIcon variant="light" color={isScan ? 'grape' : 'brand'} size={28} radius="md">
                {isScan ? <IconPhotoScan size={14} /> : <IconFileText size={14} />}
              </ThemeIcon>
              <div style={{ minWidth: 0, flex: 1 }}>
                <Text size="sm" fw={500} truncate>
                  {template.title}
                </Text>
                <Text size="xs" c="dimmed">
                  {timesLabel(entry.count)}
                </Text>
              </div>
            </Group>
          </Link>
        );
      })}
    </Stack>
  );
}
