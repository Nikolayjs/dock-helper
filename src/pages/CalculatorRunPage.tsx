import { useMemo, useState } from 'react';
import { Alert, Anchor, Badge, Button, Card, Container, Group, Loader, Modal, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconEdit, IconInfoCircle, IconStethoscope } from '@tabler/icons-react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { CalculatorForm } from '../features/calculators/CalculatorForm';
import { createDraftPreset, PresetEditorRow, type DraftPreset } from '../features/calculators/builder/PresetEditorRow';
import { autofillFromPatient } from '../features/calculators/patientAutofill';
import { SaveToVisitModal } from '../features/calculators/SaveToVisitModal';
import { useCalculators } from '../features/calculators/useCalculators';
import { CREATININE, latestValueByName } from '../features/labResults/latestValue';
import { useLabResults } from '../features/labResults/useLabResults';
import { usePatients } from '../features/patients/usePatients';
import { calcAge } from '../features/patients/utils';
import { BackButton } from '../components/common/BackButton';

export function CalculatorRunPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { calculators, isLoading, updateCalculator } = useCalculators();
  const [draftPreset, setDraftPreset] = useState<DraftPreset | null>(null);
  const [resultLine, setResultLine] = useState<string | null>(null);

  /**
   * Пациент приезжает адресом (`?patientId=`) — из его карточки и из списка калькуляторов,
   * открытого оттуда же. Без него страница работает как раньше: калькулятор сам по себе.
   */
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patientId');
  const { patients, isLoading: patientsLoading } = usePatients();
  const { results, isLoading: resultsLoading } = useLabResults();
  const patient = patientId ? patients.find((item) => item.id === patientId) : undefined;

  const definition = calculators.find((calc) => calc.id === id);

  const filled = useMemo(() => {
    if (!definition || !patient) return [];
    const creatinine = latestValueByName(
      results.filter((result) => result.patientId === patient.id),
      CREATININE,
    );
    return autofillFromPatient(definition.fields, {
      ageYears: calcAge(patient.birthDate),
      sex: patient.sex,
      heightCm: patient.heightCm,
      weightKg: patient.weightKg,
      creatinine: creatinine ? { value: creatinine.value, takenAt: creatinine.takenAt } : null,
    });
  }, [definition, patient, results]);

  // Форма берёт подставленное один раз, при монтировании: пока карточка и бланки едут, рисовать её
  // нельзя — иначе подстановка опоздала бы и пришлось бы перетирать уже набранное врачом.
  if (patientId && (patientsLoading || resultsLoading)) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (!definition) {
    if (isLoading) {
      return (
        <Group justify="center" py="xl">
          <Loader />
        </Group>
      );
    }
    return <Navigate to="/calculators" replace />;
  }

  const handleSavePreset = async () => {
    if (!draftPreset || !draftPreset.label.trim()) return;
    const { uid: _uid, ...preset } = draftPreset;
    await updateCalculator({ ...definition, presets: [...(definition.presets ?? []), preset] });
    notifications.show({ message: 'Пресет добавлен', color: 'teal' });
    setDraftPreset(null);
  };

  return (
    <Container size="md" px={0}>
      <div style={{ marginBottom: 'var(--mantine-spacing-lg)' }}>
        <BackButton fallback={{ to: '/calculators', label: 'К списку калькуляторов' }} />
      </div>

      <Card withBorder padding="xl">
        <Group justify="space-between" align="flex-start" mb="lg">
          <Group gap="md" align="flex-start">
            <ThemeIcon size={52} radius="md" variant="light" color="brand">
              <IconStethoscope size={26} />
            </ThemeIcon>
            <div>
              <Group gap={8} mb={4}>
                <Title order={3}>{definition.title}</Title>
                <Badge variant="light" color="brand">
                  {definition.category}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                {definition.description}
              </Text>
            </div>
          </Group>
          <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/calculators/${definition.id}/edit`)}>
            Изменить
          </Button>
        </Group>

        <Stack gap="lg">
          {/* Подставленное называется вслух — иначе врач не узнает, что вес приехал из карточки, и
              не проверит, когда его измеряли. Ровно та же причина, по которой анализатор пишет,
              для какого возраста взяты нормы. */}
          {patient && filled.length > 0 && (
            <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
              Заполнено из карточки{' '}
              <Anchor component={Link} to={`/patients/${patient.id}`} state={{ from: `/calculators/${definition.id}` }}>
                {patient.fullName}
              </Anchor>
              : {filled.map((item) => `${item.label.toLowerCase()} ${item.display}${item.note ? ` (${item.note})` : ''}`).join(', ')}.
              Поправьте, если что-то изменилось.
            </Alert>
          )}
          {patient && filled.length === 0 && (
            <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
              В карточке {patient.fullName} нет значений, подходящих этому калькулятору, — заполните поля вручную.
            </Alert>
          )}

          <CalculatorForm
            definition={definition}
            onAddPreset={() => setDraftPreset(createDraftPreset())}
            initialValues={Object.fromEntries(filled.map((item) => [item.fieldKey, item.value]))}
            onSaveResult={patient ? setResultLine : undefined}
          />
        </Stack>
      </Card>

      {patient && <SaveToVisitModal patient={patient} line={resultLine} onClose={() => setResultLine(null)} />}

      <Modal opened={draftPreset !== null} onClose={() => setDraftPreset(null)} title="Новый пресет" radius="lg" size="lg" centered>
        {draftPreset && (
          <Stack gap="md">
            <PresetEditorRow
              preset={draftPreset}
              fields={definition.fields.map((field) => ({ ...field, uid: field.key }))}
              onChange={setDraftPreset}
              onRemove={() => setDraftPreset(null)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDraftPreset(null)}>
                Отмена
              </Button>
              <Button onClick={handleSavePreset} disabled={!draftPreset.label.trim()}>
                Сохранить пресет
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Container>
  );
}
