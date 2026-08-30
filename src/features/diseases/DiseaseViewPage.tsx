import { useState } from 'react';
import { Alert, Badge, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';
import { IconBook2, IconEdit, IconInfoCircle, IconListSearch, IconNotes } from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';

import { BackButton } from '../../components/common/BackButton';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { useAllDocuments } from '../knowledgeBase/useDocuments';
import { DiseaseForm } from './DiseaseForm';
import type { DiseaseInput } from './types';
import { useDiseases } from './useDiseases';

/**
 * Карточка заболевания.
 *
 * Отвечает ровно на три вопроса и ни на один сверх: как болезнь ещё называют, каким кодом её
 * кодируют и где про неё читать подробно. Пересказывать сюда клиническую рекомендацию нельзя —
 * это был бы второй источник об одном и том же, и он разошёлся бы с первым при первой правке.
 *
 * **Пустое описание показывается как пустое.** Врач видит, что описания пока нет, и приглашение
 * дописать — вместо выдуманного текста, который в справочнике врача опаснее пустоты: пустоту
 * видно, а сочинённое — нет. Ровно тем же принципом живут справки по кодированию в МКБ-10.
 */
export function DiseaseViewPage() {
  const { id } = useParams<{ id: string }>();
  const { diseases, isLoading, updateDisease } = useDiseases();
  const { documents } = useAllDocuments();
  const [formOpen, setFormOpen] = useState(false);

  const disease = diseases.find((row) => row.id === id) ?? null;

  // «Не найдено» до того, как список пришёл, — это враньё: страница пуста, пока едет.
  if (!disease) {
    if (isLoading) return null;
    return (
      <Container size="md" px={0}>
        <Stack gap="lg">
          <BackButton fallback={{ to: '/reference', label: 'К справочнику' }} />
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
            Такого заболевания в справочнике нет — возможно, запись удалили.
          </Alert>
        </Stack>
      </Container>
    );
  }

  // `guidelineId` уже разрешён сервером: сам ключ в ответы не попадает, см. комментарий в
  // `DiseasesService.list()`.
  const guideline = disease.guidelineId
    ? (documents.find((doc) => doc.id === disease.guidelineId) ?? null)
    : null;

  const save = (input: DiseaseInput) => updateDisease(disease.id, input);

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <BackButton fallback={{ to: '/reference', label: 'К справочнику' }} />
          <Button variant="default" leftSection={<IconEdit size={16} />} onClick={() => setFormOpen(true)}>
            {disease.description ? 'Править' : 'Дополнить описание'}
          </Button>
        </Group>

        <ReadingSheet>
          <Stack gap="md">
            <div>
              <Title order={2}>{disease.name}</Title>
              {disease.synonyms.length > 0 && (
                <Text size="sm" c="dimmed" mt={4}>
                  Также: {disease.synonyms.join(' · ')}
                </Text>
              )}
            </div>

            {disease.summary && <Text>{disease.summary}</Text>}

            <Group gap="xs" wrap="wrap">
              <Text size="sm" c="dimmed">
                Раздел:
              </Text>
              <Badge variant="light" color="gray" tt="none">
                {disease.category || 'без раздела'}
              </Badge>
            </Group>

            {/* Коды ведут в карточку кода — там класс, блок и соседние коды. */}
            <Group gap="xs" wrap="wrap" align="center">
              <Text size="sm" c="dimmed">
                МКБ-10:
              </Text>
              {disease.icdCodes.length === 0 ? (
                <Text size="sm" c="dimmed">
                  однозначный код не сопоставлен
                </Text>
              ) : (
                disease.icdCodes.map((code) => (
                  <Badge
                    key={code}
                    component={Link}
                    to={`/icd10/${encodeURIComponent(code)}`}
                    state={{ from: `/reference/diseases/${disease.id}` }}
                    variant="light"
                    ff="monospace"
                    tt="none"
                    style={{ cursor: 'pointer' }}
                    leftSection={<IconListSearch size={12} />}
                  >
                    {code}
                  </Badge>
                ))
              )}
            </Group>

            {disease.description ? (
              // Обычный текст, а не разметка: сюда пишут своими словами, и пропускать это через
              // санитайзер незачем — разметки здесь нет по устройству поля.
              <Text style={{ whiteSpace: 'pre-wrap' }}>{disease.description}</Text>
            ) : (
              <Alert variant="light" color="gray" icon={<IconNotes size={18} />}>
                <Text size="sm">
                  Описания пока нет. Здесь можно записать то, что вы хотите помнить про эту болезнь:
                  свои формулировки, схему ведения, на что смотреть. Обновления справочника ваш текст
                  не затирают.
                </Text>
              </Alert>
            )}
          </Stack>
        </ReadingSheet>

        {guideline ? (
          <Card withBorder padding="md">
            <Group justify="space-between" wrap="wrap" gap="sm">
              <div>
                <Text fw={600} size="sm">
                  Клиническая рекомендация
                </Text>
                <Text size="sm" c="dimmed">
                  {guideline.title}
                </Text>
              </div>
              <Button
                component={Link}
                to={`/guidelines/${guideline.id}`}
                state={{ from: `/reference/diseases/${disease.id}` }}
                variant="light"
                leftSection={<IconBook2 size={16} />}
              >
                Читать
              </Button>
            </Group>
          </Card>
        ) : (
          <Card withBorder padding="md">
            <Text size="sm" c="dimmed">
              Клинической рекомендации по этой нозологии в базе знаний нет. Её можно написать в
              разделе «Клинические рекомендации» — тогда она появится здесь.
            </Text>
          </Card>
        )}
      </Stack>

      <DiseaseForm
        opened={formOpen}
        editing={disease}
        sections={[...new Set(diseases.map((row) => row.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru'))}
        onClose={() => setFormOpen(false)}
        onSubmit={save}
      />
    </Container>
  );
}
