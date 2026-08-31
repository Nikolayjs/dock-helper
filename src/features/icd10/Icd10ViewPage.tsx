import { Alert, Badge, Button, Card, Center, Container, Group, Loader, Stack, Text, Title, UnstyledButton } from '@mantine/core';
import { IconAlertTriangle, IconCheck, IconChevronRight, IconInfoCircle, IconStethoscope, IconVirus } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { BackButton } from '../../components/common/BackButton';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { useAllDocuments } from '../knowledgeBase/useDocuments';
import { useDiseasesByCode } from '../diseases/useDiseases';
import { useIcd10Card } from './useIcd10';

/**
 * Одно и то же ли это название.
 *
 * Регистр, «ё», хвост в квадратных скобках («Опоясывающий лишай [herpes zoster]») и знаки
 * препинания различий не создают — всё остальное создаёт.
 */
function sameName(a: string, b: string): boolean {
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\[[^\]]*\]/g, ' ')
      .replace(/[^а-яa-z0-9]+/gi, ' ')
      .trim();
  return normalize(a) === normalize(b);
}

/**
 * Карточка одного кода МКБ-10.
 *
 * Отвечает на три вопроса, и все три — фактические, ни один не выдуман: где код стоит в
 * классификации, что стоит рядом с ним и можно ли его ставить в диагноз. Справка по кодированию
 * показывается там, где её написали; там, где не написали, карточка молчит, а не сочиняет.
 *
 * **Конечность кода вынесена наверх и отмечена цветом.** Рубрика, у которой есть подрубрики, в
 * диагноз не ставится: `I21` там, где классификация требует уточнить локализацию, — это диагноз,
 * который не пройдёт контроль качества, и узнать об этом лучше здесь, чем из возврата реестра.
 */
export function Icd10ViewPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { card, isLoading, error } = useIcd10Card(code);
  const { documents } = useAllDocuments();
  /*
   * Связь была односторонней: болезнь называла свои коды, а код о болезнях не знал ничего — врач,
   * пришедший из реестра с кодом на руках, из классификации никуда дальше уйти не мог. Считает
   * сервер: справочник заболеваний принадлежит рабочему пространству, а классификация отдаётся без
   * входа, и подмешать одно в другое значило бы отдать записи врача любому.
   */
  const { diseases } = useDiseasesByCode(code);

  /**
   * Клиническая рекомендация с тем же названием, если она есть.
   *
   * Сопоставление по названию, а не по коду: у рекомендаций кодов нет, и заводить их значило бы
   * держать вторую классификацию рядом с первой.
   *
   * **Совпадение только точное, и это исправленная ошибка.** Сначала здесь стояло вхождение
   * подстроки в обе стороны — и «B03 Оспа» связалась с рекомендацией «Воспалительные заболевания
   * кишечника», потому что «оспа» лежит внутри слова «воспалительные». Ложная ссылка на
   * клиническую рекомендацию хуже отсутствия ссылки: врач по ней перейдёт. Замер на всех 2054
   * рубриках: точных совпадений 34, нестрогих 99 — и среди этих 99 такие связи не единичны.
   */
  const guideline = card ? documents.find((doc) => doc.kind === 'guideline' && sameName(doc.title, card.name)) : undefined;

  if (isLoading) {
    return (
      <Container size="md" px={0}>
        <Center py={100}>
          <Loader size="sm" />
        </Center>
      </Container>
    );
  }

  if (error || !card) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Код {code} в классификации не найден</Text>
          <Button component={Link} to="/icd10" mt="md">
            К справочнику МКБ-10
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <BackButton fallback={{ to: '/reference?tab=icd10', label: 'К справочнику МКБ-10' }} />

        <ReadingSheet>
          <Group gap="xs" mb={8}>
            <Badge variant="light" color="gray" size="sm" tt="none">
              Класс {card.chapter.roman}
            </Badge>
            <Badge variant="light" color="gray" size="sm" tt="none">
              {card.block.range}
            </Badge>
            {card.terminal ? (
              <Badge variant="light" color="teal" size="sm" tt="none" leftSection={<IconCheck size={11} />}>
                конечный код
              </Badge>
            ) : (
              <Badge variant="light" color="orange" size="sm" tt="none" leftSection={<IconAlertTriangle size={11} />}>
                требует уточнения
              </Badge>
            )}
          </Group>

          <Group gap="sm" align="baseline" wrap="nowrap">
            <Title order={2} ff="monospace">
              {card.code}
            </Title>
          </Group>
          <Title order={3} fw={500} mt={4}>
            {card.name}
          </Title>

          <Text size="sm" c="dimmed" mt={10}>
            {card.chapter.name} · {card.block.name}
          </Text>

          {!card.terminal && (
            <Alert variant="light" color="orange" mt="md" icon={<IconAlertTriangle size={18} />}>
              У рубрики есть подрубрики, поэтому в диагноз она не ставится: классификация требует
              уточнить код до четвёртого знака.
            </Alert>
          )}

          {card.note ? (
            <Alert variant="light" color="gray" mt="md" icon={<IconInfoCircle size={18} />}>
              {card.note}
            </Alert>
          ) : (
            <Text size="sm" c="dimmed" mt="md">
              Справки по кодированию у этой рубрики нет — ниже только то, что известно точно: место
              кода в классификации и соседние коды.
            </Text>
          )}
        </ReadingSheet>

        {diseases.length > 0 && (
          <Card withBorder padding="lg">
            <Group gap={8} mb="xs">
              <IconVirus size={18} />
              <Text fw={600}>В справочнике заболеваний</Text>
            </Group>
            <Stack gap={10}>
              {diseases.map((disease) => (
                <UnstyledButton
                  key={disease.id}
                  onClick={() => navigate(`/reference/diseases/${disease.id}`, { state: { from: `/icd10/${card.code}` } })}
                >
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600} c="brand">
                      {disease.name}
                    </Text>
                    <IconChevronRight size={14} />
                  </Group>
                  {disease.summary && (
                    <Text size="xs" c="dimmed" mt={2}>
                      {disease.summary}
                    </Text>
                  )}
                </UnstyledButton>
              ))}
            </Stack>
          </Card>
        )}

        {guideline && (
          <Card withBorder padding="lg">
            <Group gap={8} mb="xs">
              <IconStethoscope size={18} />
              <Text fw={600}>Клиническая рекомендация</Text>
            </Group>
            <UnstyledButton
              onClick={() => navigate(`/guidelines/${guideline.id}`, { state: { from: `/icd10/${card.code}` } })}
            >
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={600} c="brand">
                  {guideline.title}
                </Text>
                <IconChevronRight size={14} />
              </Group>
              {guideline.summary && (
                <Text size="xs" c="dimmed" mt={2}>
                  {guideline.summary}
                </Text>
              )}
            </UnstyledButton>
          </Card>
        )}

        {card.parent && (
          <Card withBorder padding="lg">
            <Text fw={600} mb="xs">
              Рубрика
            </Text>
            <UnstyledButton onClick={() => navigate(`/icd10/${encodeURIComponent(card.parent!.code)}`)}>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" ff="monospace" fw={600}>
                  {card.parent.code}
                </Text>
                <Text size="sm">{card.parent.name}</Text>
                <IconChevronRight size={14} />
              </Group>
            </UnstyledButton>
          </Card>
        )}

        {card.children.length > 0 && (
          <Card withBorder padding="lg">
            <Text fw={600} mb={2}>
              {card.parent ? 'Соседние коды' : 'Подрубрики'}
            </Text>
            <Text size="xs" c="dimmed" mb="md">
              {card.parent
                ? 'Другие уточнения той же рубрики — среди них выбирают, когда этот код не подходит'
                : 'Один из них и ставится в диагноз'}
            </Text>
            <Stack gap={2}>
              {card.children.map((child) => (
                <UnstyledButton
                  key={child.code}
                  onClick={() => navigate(`/icd10/${encodeURIComponent(child.code)}`)}
                  style={{ padding: '6px 0' }}
                >
                  <Group gap="sm" wrap="nowrap" align="flex-start">
                    <Text
                      size="sm"
                      ff="monospace"
                      fw={child.code === card.code ? 700 : 500}
                      c={child.code === card.code ? undefined : 'dimmed'}
                      style={{ flexShrink: 0, width: 72 }}
                    >
                      {child.code}
                    </Text>
                    <Text size="sm" fw={child.code === card.code ? 600 : 400}>
                      {child.name}
                    </Text>
                  </Group>
                </UnstyledButton>
              ))}
            </Stack>
          </Card>
        )}
      </Stack>
    </Container>
  );
}
