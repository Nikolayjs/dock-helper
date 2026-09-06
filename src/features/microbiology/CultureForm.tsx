import { useCallback } from 'react';
import { Alert, Button, Card, Checkbox, Group, Select, Stack, Switch, Text } from '@mantine/core';
import { IconInfoCircle, IconPlus } from '@tabler/icons-react';

import { IsolateCard } from './IsolateCard';
import type { ContextFlag, CultureReport, Isolate, MicrobiologyReference } from './types';

/**
 * Бланк посева: материал, обстоятельства и то, что выросло.
 *
 * Порядок полей не случаен и повторяет порядок решений: сначала **материал** — он решает больше,
 * чем возбудитель, — потом **обстоятельства**, от которых зависит и порог, и сам вопрос «лечить
 * ли», и только потом изоляты.
 */
interface CultureFormProps {
  reference: MicrobiologyReference;
  report: CultureReport;
  onChange: (next: CultureReport) => void;
}

const CONTEXT_LABEL: Record<ContextFlag, { label: string; description: string }> = {
  symptomatic: {
    label: 'Есть жалобы',
    description: 'Дизурия, лихорадка, боль — то, ради чего анализ и брали. Порог значимости при них ниже.',
  },
  catheter: { label: 'Материал взят катетером', description: 'Порог значимости другой, и флора катетера — тоже.' },
  pregnant: { label: 'Беременность', description: 'Меняет ответ на вопрос «лечить ли» — и в моче, и в гинекологии.' },
  preUrologic: {
    label: 'Готовится урологическое вмешательство',
    description: 'Второе исключение, при котором бессимптомную бактериурию лечат.',
  },
  immunocompromised: {
    label: 'Иммунодефицит, нейтропения',
    description: 'То, что у здорового человека колонизация, здесь может быть инфекцией.',
  },
};

export function CultureForm({ reference, report, onChange }: CultureFormProps) {
  const locus = reference.loci.find((l) => l.key === report.locusKey);

  const patchIsolate = useCallback(
    (uid: string, patch: Partial<Isolate>) => {
      onChange({
        ...report,
        isolates: report.isolates.map((item) => (item.uid === uid ? { ...item, ...patch } : item)),
      });
    },
    [onChange, report],
  );

  const removeIsolate = useCallback(
    (uid: string) => onChange({ ...report, isolates: report.isolates.filter((item) => item.uid !== uid) }),
    [onChange, report],
  );

  const addIsolate = () =>
    onChange({
      ...report,
      noGrowth: false,
      isolates: [...report.isolates, { uid: `iso-${Date.now()}-${report.isolates.length}`, susceptibility: [] }],
    });

  return (
    <Stack gap="md">
      <Card withBorder padding="md">
        <Stack gap="sm">
          <Select
            label="Материал"
            description="От него зависит и нормальная флора, и порог значимости"
            data={reference.loci.map((l) => ({ value: l.key, label: l.label }))}
            value={report.locusKey}
            allowDeselect={false}
            onChange={(value) => value && onChange({ ...report, locusKey: value })}
          />

          {locus && (
            <Alert variant="light" color="gray" icon={<IconInfoCircle size={16} />} title="Как берут этот материал">
              <Text size="sm">{locus.samplingNote}</Text>
            </Alert>
          )}

          {locus?.contextFlags && locus.contextFlags.length > 0 && (
            <Stack gap={6}>
              <Text size="sm" fw={500}>
                Что известно о пациенте
              </Text>
              {locus.contextFlags.map((flag) => (
                <Checkbox
                  key={flag}
                  label={CONTEXT_LABEL[flag].label}
                  description={CONTEXT_LABEL[flag].description}
                  checked={report.context.includes(flag)}
                  onChange={(event) =>
                    onChange({
                      ...report,
                      context: event.currentTarget.checked
                        ? [...report.context, flag]
                        : report.context.filter((f) => f !== flag),
                    })
                  }
                />
              ))}
            </Stack>
          )}

          <Switch
            label="Роста не выявлено"
            description="Это ответ, а не пустой бланк, и толкуется он отдельно"
            checked={report.noGrowth}
            onChange={(event) => onChange({ ...report, noGrowth: event.currentTarget.checked })}
          />
        </Stack>
      </Card>

      {!report.noGrowth && (
        <>
          {report.isolates.map((isolate, index) => (
            <IsolateCard
              key={isolate.uid}
              isolate={isolate}
              index={index}
              organisms={reference.organisms}
              antibiotics={reference.antibiotics}
              onChange={patchIsolate}
              onRemove={removeIsolate}
            />
          ))}
          <Group>
            <Button variant="light" leftSection={<IconPlus size={16} />} onClick={addIsolate}>
              {report.isolates.length === 0 ? 'Добавить возбудителя' : 'Ещё возбудитель'}
            </Button>
          </Group>
        </>
      )}
    </Stack>
  );
}
