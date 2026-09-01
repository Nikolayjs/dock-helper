import { useEffect, useMemo, useState } from 'react';

import { PageToolbar } from '../components/common/PageToolbar';
import { Alert, Badge, Box, Button, Card, Container, Group, Stack, Text, TextInput, Textarea, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconAlertTriangle, IconArrowLeft, IconDeviceFloppy, IconPlus, IconTrash } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';

import { DiagnosticSession } from '../features/diagnostics/DiagnosticSession';
import { DiseaseEditorRow, type DraftDisease } from '../features/diagnostics/builder/DiseaseEditorRow';
import { SymptomPoolEditor, type DraftSymptom } from '../features/diagnostics/builder/SymptomPoolEditor';
import type { Questionnaire } from '../features/diagnostics/types';
import { QUERY_KEY as QUESTIONNAIRES_KEY, slugifyQuestionnaireId, useQuestionnaires } from '../features/diagnostics/useQuestionnaires';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { BuilderLayout } from '../components/common/BuilderLayout';
import { FormActions } from '../components/common/FormActions';
import { useDirtyValue, useUnsavedGuard } from '../components/common/unsavedChanges';
import { useSaveAction } from '../components/common/useSaveAction';

function emptySymptom(): DraftSymptom {
  return { uid: crypto.randomUUID(), id: crypto.randomUUID(), label: '', generalPrevalence: 0.3 };
}

function emptyDisease(): DraftDisease {
  return { uid: crypto.randomUUID(), id: crypto.randomUUID(), name: '', description: '', priorWeight: 1, symptomLinks: [] };
}

export function QuestionnaireBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { questionnaires, addQuestionnaire, updateQuestionnaire, deleteQuestionnaire } = useQuestionnaires();
  const confirmDelete = useDeleteWithConfirm();

  const editingQuestionnaire = isEditMode ? questionnaires.find((q) => q.id === id) : undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [symptoms, setSymptoms] = useState<DraftSymptom[]>([emptySymptom()]);
  const [diseases, setDiseases] = useState<DraftDisease[]>([emptyDisease()]);
  const [hydrated, setHydrated] = useState(!isEditMode);

  useEffect(() => {
    if (editingQuestionnaire && !hydrated) {
      setTitle(editingQuestionnaire.title);
      setDescription(editingQuestionnaire.description);
      setSymptoms(editingQuestionnaire.symptoms.map((s) => ({ ...s, uid: crypto.randomUUID() })));
      setDiseases(editingQuestionnaire.diseases.map((d) => ({ ...d, uid: crypto.randomUUID() })));
      setHydrated(true);
    }
  }, [editingQuestionnaire, hydrated]);

  const symptomPool = symptoms.filter((s) => s.label.trim()).map((s) => ({ id: s.id, label: s.label }));

  const removeSymptom = (uid: string) => {
    const removed = symptoms.find((s) => s.uid === uid);
    setSymptoms((prev) => prev.filter((s) => s.uid !== uid));
    if (!removed) return;
    setDiseases((prev) =>
      prev.map((d) => ({ ...d, symptomLinks: d.symptomLinks.filter((l) => l.symptomId !== removed.id) })),
    );
  };

  const errors = useMemo(() => {
    const list: string[] = [];
    if (!title.trim()) list.push('Укажите название анкеты.');
    if (symptoms.length === 0) list.push('Добавьте хотя бы один симптом.');
    if (diseases.length === 0) list.push('Добавьте хотя бы одно заболевание.');

    for (const symptom of symptoms) {
      if (!symptom.label.trim()) list.push('У каждого симптома должно быть название.');
    }
    for (const disease of diseases) {
      if (!disease.name.trim()) list.push('У каждого заболевания должно быть название.');
    }

    return list;
  }, [title, symptoms, diseases]);

  const previewDefinition: Questionnaire = useMemo(
    () => ({
      id: 'preview',
      title: title || 'Новая анкета',
      description,
      symptoms: symptoms.filter((s) => s.label.trim()).map(({ uid: _uid, ...s }) => s),
      diseases: diseases
        .filter((d) => d.name.trim())
        .map(({ uid: _uid, ...d }) => d),
      createdAt: '',
      updatedAt: '',
    }),
    [title, description, symptoms, diseases],
  );

  const guard = useUnsavedGuard(useDirtyValue({ title, description, symptoms, diseases }, hydrated));

  const { saving, save: handleSave } = useSaveAction(guard, async () => {
    if (errors.length > 0) return;
    const now = new Date().toISOString();

    const questionnaire: Questionnaire = {
      ...previewDefinition,
      id: editingQuestionnaire?.id ?? slugifyQuestionnaireId(title),
      createdAt: editingQuestionnaire?.createdAt ?? now,
      updatedAt: now,
    };

    if (editingQuestionnaire) {
      await updateQuestionnaire(questionnaire);
      notifications.show({ message: 'Анкета обновлена', color: 'teal' });
      navigate(`/diagnostics/${questionnaire.id}`);
    } else {
      const created = await addQuestionnaire(questionnaire);
      notifications.show({ message: 'Анкета создана', color: 'teal' });
      navigate(`/diagnostics/${created.id}`);
    }
  });

  const handleDelete = () => {
    if (!editingQuestionnaire) return;
    confirmDelete({
      what: 'анкету',
      name: editingQuestionnaire.title,
      notice: 'Анкета удалена',
      queryKey: QUESTIONNAIRES_KEY,
      id: editingQuestionnaire.id,
      perform: () => deleteQuestionnaire(editingQuestionnaire.id),
      onConfirmed: () => navigate('/diagnostics'),
    });
  };

  return (
    <Container size="xl" px={0}>
      {/* Между полосами управления — обычный просвет страницы. Отступ снизу внутри самой
          панели давал бы то же на глаз, но панели при этом стояли бы вплотную: замер на
          конструкторе анализа — зазор 0 при пустой полосе в 20 px внутри верхней. */}
      <Box mb="lg">
        <PageToolbar>
          <Group justify="space-between">
            <Button variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} onClick={() => navigate('/diagnostics')}>
              К анкетам
            </Button>
            {editingQuestionnaire && (
              <Button variant="light" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
                Удалить
              </Button>
            )}
          </Group>
        </PageToolbar>
      </Box>

      <BuilderLayout
        previewLabel="Предпросмотр опроса"
        editor={
          <>
            <Card withBorder padding="lg">
              <Title order={4} mb="md">
                Основное
              </Title>
              <Stack gap="md">
                <TextInput label="Название анкеты" placeholder="Например: Периодические лихорадки у детей" value={title} onChange={(e) => setTitle(e.currentTarget.value)} required />
                <Textarea label="Описание" placeholder="Коротко: для какой клинической ситуации этот опрос" value={description} onChange={(e) => setDescription(e.currentTarget.value)} autosize minRows={2} />
              </Stack>
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>Симптомы</Title>
                  <Text size="sm" c="dimmed">
                    Список того, о чём может спросить анкета.
                  </Text>
                </div>
                <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setSymptoms((prev) => [...prev, emptySymptom()])}>
                  Добавить симптом
                </Button>
              </Group>
              <Stack gap="xs">
                {symptoms.map((symptom) => (
                  <SymptomPoolEditor
                    key={symptom.uid}
                    symptom={symptom}
                    onChange={(next) => setSymptoms((prev) => prev.map((s) => (s.uid === next.uid ? next : s)))}
                    onRemove={() => removeSymptom(symptom.uid)}
                  />
                ))}
              </Stack>
            </Card>

            <Card withBorder padding="lg">
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>Заболевания</Title>
                  <Text size="sm" c="dimmed">
                    Кандидаты дифференциального ряда и то, насколько типичен для них каждый симптом.
                  </Text>
                </div>
                <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setDiseases((prev) => [...prev, emptyDisease()])}>
                  Добавить заболевание
                </Button>
              </Group>
              <Stack gap="sm">
                {diseases.map((disease) => (
                  <DiseaseEditorRow
                    key={disease.uid}
                    disease={disease}
                    symptomPool={symptomPool}
                    onChange={(next) => setDiseases((prev) => prev.map((d) => (d.uid === next.uid ? next : d)))}
                    onRemove={() => setDiseases((prev) => prev.filter((d) => d.uid !== disease.uid))}
                  />
                ))}
              </Stack>
            </Card>

            {errors.length > 0 && (
              <Alert color="orange" icon={<IconAlertTriangle size={18} />} title="Проверьте форму">
                <Stack gap={2}>
                  {errors.map((err, i) => (
                    <Text size="sm" key={i}>
                      • {err}
                    </Text>
                  ))}
                </Stack>
              </Alert>
            )}

            {guard.render({ onSave: errors.length === 0 ? handleSave : undefined })}
          </>
        }
        actions={
          <FormActions>
            <Group justify="flex-end">
              <Button size="md" leftSection={<IconDeviceFloppy size={18} />} onClick={handleSave} loading={saving} disabled={errors.length > 0}>
                {editingQuestionnaire ? 'Сохранить изменения' : 'Создать анкету'}
              </Button>
            </Group>
          </FormActions>
        }
        preview={
          /* Опрос идёт естественной высотой и прокручивается страницей — см. пояснение у калькулятора. */
          <Stack gap="lg">
            <Badge variant="light" color="gray">
              Предпросмотр опроса
            </Badge>
            <DiagnosticSession diseases={previewDefinition.diseases} symptoms={previewDefinition.symptoms} />
          </Stack>
        }
      />
    </Container>
  );
}
