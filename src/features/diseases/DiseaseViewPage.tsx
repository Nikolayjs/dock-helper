import { Alert, Anchor, Badge, Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';

import { PageToolbar } from '../../components/common/PageToolbar';
import { IconBook2, IconEdit, IconInfoCircle, IconListSearch, IconNotes } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BackButton } from '../../components/common/BackButton';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { SafeHtml } from '../../components/common/SafeHtml';
import { useAllDocuments } from '../knowledgeBase/useDocuments';
import { descriptionToHtml } from './description';
import { renderDiseaseWiki } from './wiki';
import { useAbbreviations } from '../abbreviations/useAbbreviations';
import { useDisease, useDiseaseMentions, useDiseases } from './useDiseases';

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
  const navigate = useNavigate();
  const { diseases, isLoading } = useDiseases();
  const { documents } = useAllDocuments();
  const { abbreviations } = useAbbreviations();
  /*
   * Описание дочитывается отдельным запросом: в списке его нет — тексты вики растут, и возить их
   * все с каждой страницей раздела значило бы повторить ошибку базы знаний. Шапка карточки при
   * этом рисуется сразу из списка и пустотой не мигает.
   */
  const { disease: full } = useDisease(id);
  const { mentions } = useDiseaseMentions(id);

  const summary = diseases.find((row) => row.id === id) ?? null;
  const disease = summary ?? full;
  const description = full?.description ?? '';

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

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <PageToolbar>
          <Group justify="space-between" wrap="wrap">
            <BackButton fallback={{ to: '/reference', label: 'К справочнику' }} />
            <Button
              component={Link}
              to={`/reference/diseases/${disease.id}/edit`}
              variant="default"
              leftSection={<IconEdit size={16} />}
            >
              {(summary?.hasDescription ?? Boolean(description)) ? 'Править' : 'Дополнить описание'}
            </Button>
          </Group>
        </PageToolbar>

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

            {description ? (
              /* Чужая разметка — через общий санитайзер, как статья и документ врача: описание
                 приносят вставкой из руководства, то есть это ровно тот случай, ради которого
                 `SafeHtml` и заведён. `descriptionToHtml` по дороге поднимает абзацы у записей,
                 сделанных до появления редактора, а `renderDiseaseWiki` превращает `[[Название]]`
                 в переходы.

                 Переход ловится на обёртке, а не на самой ссылке: разметку рисует `SafeHtml`, и
                 обработчика внутри неё нет. Тот же приём, что в базе знаний. */
              <div
                onClick={(e) => {
                  const link = (e.target as HTMLElement).closest('[data-wiki-link]');
                  const href = link?.getAttribute('href');
                  if (href) {
                    e.preventDefault();
                    navigate(href, { state: { from: `/reference/diseases/${disease.id}` } });
                  }
                }}
              >
                <SafeHtml
                  html={renderDiseaseWiki(descriptionToHtml(description), { diseases, documents, abbreviations })}
                />
              </div>
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

        {mentions.length > 0 && (
          /*
             Обратные ссылки: кто ссылается сюда.
        
             Вики без них — дорога в один конец: врач, пришедший на «Фибрилляцию предсердий»,
             не узнает, что о ней говорит карточка тиреотоксикоза. Считает их сервер — собрать
             такой список на клиенте можно только скачав все описания разом.
          */
          <Card withBorder padding="md">
            <Text fw={600} size="sm" mb="xs">
              Упоминается в
            </Text>
            <Stack gap={6}>
              {mentions.map((row) => (
                <Group key={row.id} gap={8} wrap="nowrap" align="baseline">
                  <Anchor
                    component={Link}
                    to={`/reference/diseases/${row.id}`}
                    state={{ from: `/reference/diseases/${disease.id}` }}
                    size="sm"
                  >
                    {row.name}
                  </Anchor>
                  <Text size="xs" c="dimmed" lineClamp={1}>
                    {row.summary}
                  </Text>
                </Group>
              ))}
            </Stack>
          </Card>
        )}

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
    </Container>
  );
}
