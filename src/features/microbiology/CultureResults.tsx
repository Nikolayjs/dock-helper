import { Alert, Badge, Card, Divider, Group, List, Stack, Text, ThemeIcon } from '@mantine/core';

import { InlineBold } from '../../components/common/InlineBold';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconFlask,
  IconInfoCircle,
  IconShieldOff,
  IconVaccine,
} from '@tabler/icons-react';

import { LocusFloraGuide } from './LocusFloraGuide';
import { SEVERITY_COLOR, SIGNIFICANCE_COLOR, SIGNIFICANCE_LABEL, sup } from './cultureEngine';
import type { CultureVerdict, IsolateVerdict } from './cultureEngine';
import type { MicrobiologyReference } from './types';

/**
 * Разбор посева.
 *
 * Порядок блоков повторяет порядок решений врача, а не порядок бланка: сначала **значим ли рост**
 * (от этого зависит, нужно ли остальное), затем **не врёт ли бланк**, затем **лечить ли вообще**, и
 * только в конце — чем.
 *
 * Расхождения с природной устойчивостью стоят **выше списка препаратов**, а не рядом с ними: их
 * смысл в том, что часть бланка читать нельзя, и узнать об этом после выбора препарата поздно.
 */
interface CultureResultsProps {
  verdict: CultureVerdict;
  reference: MicrobiologyReference;
}

function IsolateBlock({ item }: { item: IsolateVerdict }) {
  return (
    <Card withBorder padding="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Text fw={600}>{item.label}</Text>
          <Badge color={SIGNIFICANCE_COLOR[item.significance]} variant="light" style={{ flexShrink: 0 }}>
            {SIGNIFICANCE_LABEL[item.significance]}
          </Badge>
        </Group>

        <Text size="sm">
          <InlineBold text={item.why} />
        </Text>

        {item.conflicts.length > 0 && (
          <Alert
            variant="light"
            color="red"
            icon={<IconShieldOff size={16} />}
            title="Бланк противоречит природной устойчивости"
          >
            <Stack gap="xs">
              <Text size="sm">
                Лаборатория напечатала «чувствителен» там, где чувствительности не бывает. Это ошибка бланка, а не
                удача: препарат не сработает.
              </Text>
              <List size="sm" spacing={4}>
                {item.conflicts.map((conflict) => (
                  <List.Item key={conflict.ruleId + conflict.label}>
                    <Text span fw={600} size="sm">
                      {conflict.label} — {conflict.result}.
                    </Text>{' '}
                    <Text span size="sm">
                      <InlineBold text={conflict.why} />
                    </Text>
                  </List.Item>
                ))}
              </List>
            </Stack>
          </Alert>
        )}

        {item.phenotypes.map((phenotype) => (
          <Alert
            key={phenotype.id}
            variant="light"
            color={SEVERITY_COLOR[phenotype.severity]}
            icon={<IconAlertTriangle size={16} />}
            title={phenotype.title}
          >
            <Text size="sm">
              <InlineBold text={phenotype.meaning} />
            </Text>
          </Alert>
        ))}

        {item.notes.map((note) => (
          <Alert
            key={note.id}
            variant="light"
            color={SEVERITY_COLOR[note.severity]}
            icon={<IconInfoCircle size={16} />}
            title={note.title}
          >
            <Text size="sm">
              <InlineBold text={note.text} />
            </Text>
          </Alert>
        ))}

        {item.options.length > 0 && (
          <Stack gap={6}>
            <Group gap={6}>
              <ThemeIcon size="sm" variant="light" color="teal">
                <IconVaccine size={14} />
              </ThemeIcon>
              <Text size="sm" fw={500}>
                Годятся по этому бланку
              </Text>
            </Group>
            <List size="sm" spacing={4}>
              {item.options.map((option) => (
                <List.Item
                  key={option.entry.antibioticKey}
                  icon={
                    <ThemeIcon size={18} radius="xl" variant="light" color={option.entry.result === 'S' ? 'teal' : 'yellow'}>
                      <IconCircleCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  <Text span fw={600} size="sm">
                    {option.label}
                  </Text>
                  {option.caution && (
                    <Text size="xs" c="dimmed">
                      {option.caution}
                    </Text>
                  )}
                </List.Item>
              ))}
            </List>
            <Text size="xs" c="dimmed">
              Список идёт от узких препаратов к широким: первым стоит не самый мощный, а самый узкий из работающих.
            </Text>
          </Stack>
        )}

        {item.suppressed.length > 0 && (
          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Не годятся, хотя в бланке «чувствителен»
            </Text>
            <List size="sm" spacing={4}>
              {item.suppressed.map((drug) => (
                <List.Item key={drug.entry.antibioticKey}>
                  <Text span fw={600} size="sm">
                    {drug.label}.
                  </Text>{' '}
                  <Text span size="sm" c="dimmed">
                    {/* Природную устойчивость целиком объясняет блок расхождений выше — повторять
                        здесь тот же абзац значит заставлять читать его дважды подряд. */}
                    {drug.suppressedBy?.kind === 'intrinsic'
                      ? 'Природная устойчивость — объяснение в расхождениях выше.'
                      : drug.suppressedBy?.why}
                  </Text>
                </List.Item>
              ))}
            </List>
          </Stack>
        )}

        {item.resistant.length > 0 && (
          <>
            <Divider />
            <Text size="xs" c="dimmed">
              Устойчив по бланку: {item.resistant.map((drug) => drug.label).join(', ')}.
            </Text>
          </>
        )}

        {item.options.length === 0 && item.suppressed.length === 0 && item.resistant.length === 0 && (
          <Text size="xs" c="dimmed">
            Антибиотикограмма не введена — разбор отвечает только на вопрос о значимости роста.
          </Text>
        )}
      </Stack>
    </Card>
  );
}

export function CultureResults({ verdict, reference }: CultureResultsProps) {
  const { locus, isolates, notes } = verdict;
  const nothingEntered = isolates.length === 0 && notes.length === 0;

  return (
    <Stack gap="md">
      {locus && (
        <Card withBorder padding="md">
          <Stack gap="xs">
            <Group gap={6}>
              <ThemeIcon size="sm" variant="light">
                <IconFlask size={14} />
              </ThemeIcon>
              <Text fw={600}>{locus.label}</Text>
            </Group>
            <Text size="sm">
              <InlineBold text={locus.note} />
            </Text>
            {locus.threshold !== undefined && (
              <Text size="xs" c="dimmed">
                Порог значимости по умолчанию — 10{sup(locus.threshold)} КОЕ/мл; при жалобах и при заборе катетером он
                другой.
              </Text>
            )}
          </Stack>
        </Card>
      )}

      {locus && <LocusFloraGuide reference={reference} locus={locus} />}

      {notes.map((note) => (
        <Alert
          key={note.id}
          variant="light"
          color={SEVERITY_COLOR[note.severity]}
          icon={<IconInfoCircle size={16} />}
          title={note.title}
        >
          <Text size="sm">
              <InlineBold text={note.text} />
            </Text>
        </Alert>
      ))}

      {isolates.map((item) => (
        <IsolateBlock key={item.isolate.uid} item={item} />
      ))}

      {nothingEntered && (
        <Card withBorder padding="md">
          <Text size="sm" c="dimmed">
            Добавьте возбудителя из бланка — или отметьте «роста не выявлено», если лаборатория ничего не выделила.
          </Text>
        </Card>
      )}
    </Stack>
  );
}
