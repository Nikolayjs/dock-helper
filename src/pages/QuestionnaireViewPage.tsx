import { Box, Button, Card, Container, Group, Stack, Tabs, Text, Title } from '@mantine/core';

import { PageToolbar } from '../components/common/PageToolbar';
import { IconArrowLeft, IconEdit, IconHelpCircle, IconListCheck } from '@tabler/icons-react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { DiagnosticSession } from '../features/diagnostics/DiagnosticSession';
import { SymptomPicker } from '../features/diagnostics/SymptomPicker';
import { useDiagnosticAnswers } from '../features/diagnostics/useDiagnosticAnswers';
import { useQuestionnaires } from '../features/diagnostics/useQuestionnaires';

const TABS = ['session', 'symptoms'] as const;
type PanelTab = (typeof TABS)[number];

export function QuestionnaireViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { questionnaires } = useQuestionnaires();
  const questionnaire = questionnaires.find((q) => q.id === id);

  /**
   * Разбор один на обе вкладки, и живёт он здесь.
   *
   * Опрос и выбор симптомов — два вида на один случай: врач отмечает то, что видит перед собой, а
   * недостающее добирает вопросами. Своё состояние у каждой вкладки означало бы два разных
   * дифференциальных ряда на соседних вкладках — и непонятно, какой из них про этого пациента.
   * Поэтому состояние стоит над `Tabs`, а не внутри: с `keepMounted={false}` содержимое закрытой
   * вкладки размонтировано, и всё, что лежало бы в нём, терялось бы при переключении.
   */
  const state = useDiagnosticAnswers();

  const raw = params.get('tab');
  const tab: PanelTab = TABS.includes(raw as PanelTab) ? (raw as PanelTab) : 'session';

  // Вкладка живёт в адресе, как в «Документах» и «Справочнике»: ссылка на панель обязана
  // открывать тот режим, ради которого её дали. `replace` — чтобы переключение вкладок не
  // заваливало историю: «назад» должно уводить из панели, а не перебирать её режимы.
  const setTab = (next: string | null) => {
    const value = TABS.includes(next as PanelTab) ? (next as PanelTab) : 'session';
    setParams(value === 'session' ? {} : { tab: value }, { replace: true });
  };

  if (!questionnaire) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Анкета не найдена</Text>
          <Button component={Link} to="/diagnostics" mt="md">
            К списку анкет
          </Button>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md" px={0}>
      <Tabs variant="pills" value={tab} onChange={setTab} keepMounted={false}>
        <Stack gap="lg">
          <PageToolbar
            tabs={
              <Tabs.List>
                <Tabs.Tab value="session" leftSection={<IconHelpCircle size={16} />}>
                  Опрос
                </Tabs.Tab>
                <Tabs.Tab value="symptoms" leftSection={<IconListCheck size={16} />}>
                  Выбор симптомов
                </Tabs.Tab>
              </Tabs.List>
            }
          >
            <Group justify="space-between" wrap="wrap">
              <Button
                component={Link}
                to="/diagnostics"
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                pl={8}
              >
                К списку анкет
              </Button>
              <Button
                variant="light"
                leftSection={<IconEdit size={16} />}
                onClick={() => navigate(`/diagnostics/${questionnaire.id}/edit`)}
              >
                Редактировать
              </Button>
            </Group>
          </PageToolbar>

          {/*
            Название и описание панели — на поверхности, как всё содержательное в приложении.
            Описание здесь не подпись к списку, а несколько строк про то, что панель разграничивает:
            лёжа прямо на фоне, они на обоях оказывались на фотографии.
          */}
          <Card withBorder padding="lg">
            <Title order={3}>{questionnaire.title}</Title>
            {questionnaire.description && (
              <Text size="sm" c="dimmed" mt={6}>
                {questionnaire.description}
              </Text>
            )}
          </Card>

          <Box>
            <Tabs.Panel value="session">
              <DiagnosticSession diseases={questionnaire.diseases} symptoms={questionnaire.symptoms} state={state} />
            </Tabs.Panel>

            <Tabs.Panel value="symptoms">
              <SymptomPicker diseases={questionnaire.diseases} symptoms={questionnaire.symptoms} state={state} />
            </Tabs.Panel>
          </Box>
        </Stack>
      </Tabs>
    </Container>
  );
}
