import { useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  FileButton,
  Group,
  Loader,
  Modal,
  ScrollArea,
  Select,
  Stack,
  Text,
} from '@mantine/core';
import { IconAlertTriangle, IconFileUpload, IconInfoCircle, IconPlus } from '@tabler/icons-react';

import { HttpRepositoryError } from '../../../lib/httpRepository';
import type { LabTestDefinition } from '../types';
import { LabFileError, extractLabFileLines } from './labFileText';
import { matchAnalytes, type MatchPlan } from './matchAnalytes';
import { parseLabValues, type ParsedAnalyte } from './parseLabValues';

/**
 * Reads a lab result file and shows what was found before anything is filled in.
 *
 * The review step is not ceremony. Parsing a layout no laboratory documents is guesswork, and a
 * value silently dropped into the wrong parameter is worse than no import at all — so every pairing
 * is shown with the row it came from, and nothing reaches the form until the doctor agrees.
 */

interface LabFileImportModalProps {
  opened: boolean;
  onClose: () => void;
  tests: LabTestDefinition[];
  onApply: (values: Record<string, Record<string, number>>) => void;
  onCreateAnalyzer: (analytes: ParsedAnalyte[]) => void;
  /**
   * Appends the analytes to an existing analyzer as new parameters and resolves with the updated
   * analyzer list — returned rather than awaited from a refetch so the review can re-match against
   * the new parameters immediately, and the values the doctor came here for land in the same step.
   */
  onExtendAnalyzer: (testId: string, analytes: ParsedAnalyte[]) => Promise<LabTestDefinition[]>;
}

type Stage =
  | { kind: 'idle' }
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  /** `analytes` is kept alongside the plan so the file can be re-matched after an analyzer gains parameters. */
  | { kind: 'review'; analytes: ParsedAnalyte[]; plan: MatchPlan };

/** Below this an analyzer is more likely sharing a couple of common names than actually present in the file. */
const CONFIDENT_MATCH_COUNT = 3;

/** And below this share of the best-matching analyzer, it is riding on names that panel merely shares. */
const CONFIDENT_MATCH_SHARE = 0.4;

/**
 * Ticks the analyzers the file plausibly contains, and leaves the rest for the doctor to opt into.
 *
 * Глюкоза, белок and билирубин are all measured in both blood and urine, under the same names and
 * often the same units, so name matching alone cannot tell a urinalysis from a blood panel. What
 * can is proportion: a urinalysis form filled 32 of the urinalysis parameters and 3 of the
 * biochemistry ones, and those 3 were urine values about to be filed as blood chemistry — a urine
 * glucose of 0 reading as profound hypoglycaemia. One file is one specimen, so an analyzer trailing
 * far behind the leader is left for the doctor to tick deliberately.
 */
function defaultSelection(plan: MatchPlan): string[] {
  const best = plan.fills[0]?.matches.length ?? 0;
  const confident = plan.fills.filter(
    (fill) => fill.matches.length >= CONFIDENT_MATCH_COUNT && fill.matches.length >= best * CONFIDENT_MATCH_SHARE,
  );
  if (confident.length > 0) return confident.map((fill) => fill.test.id);
  // Nothing reached the bar: fall back to the strongest single candidate rather than nothing at all.
  return plan.fills.slice(0, 1).map((fill) => fill.test.id);
}

export function LabFileImportModal({
  opened,
  onClose,
  tests,
  onApply,
  onCreateAnalyzer,
  onExtendAnalyzer,
}: LabFileImportModalProps) {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' });
  const [selectedTestIds, setSelectedTestIds] = useState<string[]>([]);
  const [extendTargetId, setExtendTargetId] = useState<string | null>(null);
  const [extending, setExtending] = useState(false);

  const reset = () => {
    setStage({ kind: 'idle' });
    setSelectedTestIds([]);
    setExtendTargetId(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setStage({ kind: 'reading' });
    try {
      const lines = await extractLabFileLines(file);
      const analytes = parseLabValues(lines);
      if (analytes.length === 0) {
        setStage({
          kind: 'error',
          message: 'В файле не нашлось ни одного показателя со значением. Возможно, это не бланк результатов.',
        });
        return;
      }
      const plan = matchAnalytes(analytes, tests);
      setSelectedTestIds(defaultSelection(plan));
      setExtendTargetId(plan.fills[0]?.test.id ?? tests[0]?.id ?? null);
      setStage({ kind: 'review', analytes, plan });
    } catch (error) {
      const message =
        error instanceof LabFileError || error instanceof HttpRepositoryError
          ? error.message
          : 'Не удалось прочитать файл.';
      setStage({ kind: 'error', message });
    }
  };

  const extendSelected = async () => {
    if (stage.kind !== 'review' || !extendTargetId) return;
    setExtending(true);
    try {
      const updatedTests = await onExtendAnalyzer(extendTargetId, stage.plan.unmatched);
      const plan = matchAnalytes(stage.analytes, updatedTests);
      // The extended analyzer is now the point of the exercise — tick it even if the count is low.
      setSelectedTestIds([...new Set([...defaultSelection(plan), extendTargetId])]);
      setStage({ kind: 'review', analytes: stage.analytes, plan });
    } catch (error) {
      setStage({
        kind: 'error',
        message: error instanceof HttpRepositoryError ? error.message : 'Не удалось сохранить анализатор.',
      });
    } finally {
      setExtending(false);
    }
  };

  const applySelected = () => {
    if (stage.kind !== 'review') return;
    const values: Record<string, Record<string, number>> = {};
    for (const fill of stage.plan.fills) {
      if (!selectedTestIds.includes(fill.test.id)) continue;
      // m.value, not m.analyte.value: a result printed in г/дл has been rescaled to the
      // parameter's г/л, and the raw number would be off by a factor of ten.
      values[fill.test.id] = Object.fromEntries(fill.matches.map((m) => [m.param.key, m.value]));
    }
    onApply(values);
    close();
  };

  const matchedCount =
    stage.kind === 'review'
      ? stage.plan.fills
          .filter((f) => selectedTestIds.includes(f.test.id))
          .reduce((sum, f) => sum + f.matches.length, 0)
      : 0;

  return (
    <Modal opened={opened} onClose={close} title="Загрузить файл анализов" size="lg" radius="lg" centered>
      {stage.kind === 'idle' && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            PDF из лаборатории читается точно — в нём есть текстовый слой. Снимок бланка распознаётся, и в нём
            возможны ошибки, поэтому всё найденное сначала показывается на проверку.
          </Text>
          <FileButton onChange={handleFile} accept="application/pdf,image/jpeg,image/png,image/webp,image/tiff,image/bmp">
            {(props) => (
              <Button {...props} leftSection={<IconFileUpload size={16} />}>
                Выбрать файл
              </Button>
            )}
          </FileButton>
        </Stack>
      )}

      {stage.kind === 'reading' && (
        <Group justify="center" py="xl" gap="sm">
          <Loader size="sm" />
          <Text size="sm" c="dimmed">
            Читаю файл…
          </Text>
        </Group>
      )}

      {stage.kind === 'error' && (
        <Stack gap="md">
          <Alert color="orange" icon={<IconAlertTriangle size={18} />}>
            {stage.message}
          </Alert>
          <Group justify="flex-end">
            <Button variant="default" onClick={reset}>
              Выбрать другой файл
            </Button>
          </Group>
        </Stack>
      )}

      {stage.kind === 'review' && (
        <Stack gap="md">
          {stage.plan.fills.length === 0 ? (
            <Alert color="orange" icon={<IconInfoCircle size={18} />}>
              Показатели в файле нашлись, но ни один не совпал с существующими анализаторами.
            </Alert>
          ) : (
            <ScrollArea.Autosize mah={340}>
              <Stack gap="sm">
                {stage.plan.fills.map((fill) => (
                  <Card key={fill.test.id} withBorder padding="sm" radius="md">
                    <Checkbox
                      checked={selectedTestIds.includes(fill.test.id)}
                      onChange={(event) =>
                        setSelectedTestIds((prev) =>
                          event.currentTarget.checked
                            ? [...prev, fill.test.id]
                            : prev.filter((id) => id !== fill.test.id),
                        )
                      }
                      label={
                        <Group gap="xs">
                          <Text fw={600} size="sm">
                            {fill.test.title}
                          </Text>
                          <Badge variant="light" size="sm">
                            {fill.matches.length}
                          </Badge>
                        </Group>
                      }
                    />
                    <Accordion variant="filled" chevronPosition="left" mt={4}>
                      <Accordion.Item value="matches">
                        <Accordion.Control>
                          <Text size="xs" c="dimmed">
                            Показать, что подставится
                          </Text>
                        </Accordion.Control>
                        <Accordion.Panel>
                          <Stack gap={6}>
                            {fill.matches.map((match) => (
                              <Group key={match.param.key} justify="space-between" wrap="nowrap" gap="sm">
                                <div style={{ minWidth: 0 }}>
                                  <Text size="sm">
                                    {match.param.label}{' '}
                                    <Text span size="sm" fw={600}>
                                      {match.value}
                                    </Text>{' '}
                                    <Text span size="xs" c="dimmed">
                                      {match.param.unit ?? match.analyte.unit ?? ''}
                                    </Text>
                                  </Text>
                                  {/* A rescaled value is not the number printed on the form, so the
                                      arithmetic is shown rather than left for the doctor to doubt. */}
                                  {match.conversion && (
                                    <Text size="xs" c="dimmed">
                                      пересчитано из {match.analyte.value} {match.conversion.from}
                                    </Text>
                                  )}
                                  {/* The source row, so a mispaired value is caught by eye. */}
                                  <Text size="xs" c="dimmed" lineClamp={1}>
                                    {match.analyte.line}
                                  </Text>
                                </div>
                                {match.score < 0.95 && (
                                  <Badge size="xs" variant="light" color="orange">
                                    похоже
                                  </Badge>
                                )}
                              </Group>
                            ))}
                          </Stack>
                        </Accordion.Panel>
                      </Accordion.Item>
                    </Accordion>
                  </Card>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          )}

          {/* Not a failure and not an import: the form computes these from the values just filled in,
              and saying so is what keeps them from being read as rows that went missing. */}
          {stage.plan.derived.length > 0 && (
            <Card withBorder padding="sm" radius="md">
              <Text size="sm" fw={600} mb={4}>
                Рассчитываются автоматически: {stage.plan.derived.length}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={3}>
                {stage.plan.derived.map((a) => `${a.name} ${a.value}`).join(' · ')}
              </Text>
            </Card>
          )}

          {stage.plan.unmatched.length > 0 && (
            <Card withBorder padding="sm" radius="md">
              <Text size="sm" fw={600} mb={4}>
                Не совпало: {stage.plan.unmatched.length}
              </Text>
              <Text size="xs" c="dimmed" lineClamp={3} mb="xs">
                {stage.plan.unmatched.map((a) => `${a.name} ${a.value}`).join(' · ')}
              </Text>

              {/* Two ways out, because a file wider than the analyzer means one of two things: this
                  panel is new, or the existing one was never filled in completely. */}
              <Group gap="xs" wrap="wrap" align="flex-end">
                <Select
                  size="xs"
                  w={210}
                  label="Добавить показатели в анализатор"
                  data={tests.map((t) => ({ value: t.id, label: t.shortTitle }))}
                  value={extendTargetId}
                  onChange={setExtendTargetId}
                  allowDeselect={false}
                />
                <Button size="xs" variant="light" onClick={extendSelected} loading={extending} disabled={!extendTargetId}>
                  Добавить {stage.plan.unmatched.length}
                </Button>
                <Button
                  size="xs"
                  variant="subtle"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => {
                    onCreateAnalyzer(stage.plan.unmatched);
                    close();
                  }}
                >
                  Или создать новый
                </Button>
              </Group>
            </Card>
          )}

          <Group justify="space-between">
            <Button variant="default" onClick={reset}>
              Другой файл
            </Button>
            <Button onClick={applySelected} disabled={matchedCount === 0}>
              Подставить {matchedCount > 0 ? `(${matchedCount})` : ''}
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
