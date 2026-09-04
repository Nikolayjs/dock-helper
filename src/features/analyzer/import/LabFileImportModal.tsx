import { useEffect, useRef, useState } from 'react';
import { useIsMobile } from '../../../components/common/useIsMobile';
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
import { LabFileError, extractLabFileLines, type LabFileSource } from './labFileText';
import { matchAnalytes, type MatchPlan } from './matchAnalytes';
import { parseLabValues, type ParsedAnalyte } from './parseLabValues';
import { defaultSelection } from './selectFills';

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
  /**
   * Файл, приехавший не из «Выбрать файл», а откуда-то ещё — сейчас из промежуточного слота, куда
   * его положило расширение. Разбор при этом тот же самый: экран «что нашлось» и подтверждение
   * врачом обязательны независимо от того, каким путём файл сюда попал.
   */
  incomingFile?: File | null;
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
  | { kind: 'review'; analytes: ParsedAnalyte[]; plan: MatchPlan; source: LabFileSource };

export function LabFileImportModal({
  opened,
  onClose,
  incomingFile,
  tests,
  onApply,
  onCreateAnalyzer,
  onExtendAnalyzer,
}: LabFileImportModalProps) {
  const isMobile = useIsMobile();
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
      const { lines, source } = await extractLabFileLines(file);
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
      setStage({ kind: 'review', analytes, plan, source });
    } catch (error) {
      const message =
        error instanceof LabFileError || error instanceof HttpRepositoryError
          ? error.message
          : 'Не удалось прочитать файл.';
      setStage({ kind: 'error', message });
    }
  };

  /*
   * Присланный файл разбирается один раз — по ссылке на сам файл, а не по факту открытия окна.
   * Иначе повторный рендер (а их здесь много: выбор анализаторов, разворот строк) запускал бы
   * разбор заново и стирал бы то, что врач уже отметил.
   */
  const parsedFile = useRef<File | null>(null);
  useEffect(() => {
    if (!opened || !incomingFile || parsedFile.current === incomingFile) return;
    parsedFile.current = incomingFile;
    void handleFile(incomingFile);
  }, [opened, incomingFile]);

  const extendSelected = async () => {
    if (stage.kind !== 'review' || !extendTargetId) return;
    setExtending(true);
    try {
      const updatedTests = await onExtendAnalyzer(extendTargetId, stage.plan.unmatched);
      const plan = matchAnalytes(stage.analytes, updatedTests);
      // The extended analyzer is now the point of the exercise — tick it even if the count is low.
      setSelectedTestIds([...new Set([...defaultSelection(plan), extendTargetId])]);
      setStage({ kind: 'review', analytes: stage.analytes, plan, source: stage.source });
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
    <Modal opened={opened} onClose={close} title="Загрузить файл анализов" size="lg" radius="lg" centered fullScreen={isMobile}>
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
          {/*
            Каким путём прочитан бланк — одной строкой. Разница в качестве между текстовым слоем и
            распознаванием огромна, и молчание о ней оставляет врача с ощущением «приложение плохо
            читает» там, где ему подали снимок экрана вместо файла из лаборатории.
          */}
          {stage.source !== 'pdf-text' && (
            <Text size="xs" c="dimmed">
              {stage.source === 'image'
                ? 'Прочитано распознаванием снимка — возможны ошибки. Если у вас есть PDF из лаборатории, перетащите его: он читается точно.'
                : 'В PDF нет текстового слоя, страницы распознаны как картинки — возможны ошибки.'}
            </Text>
          )}
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
