import { Button, Card, Container, Group, Stack, Text, Title } from '@mantine/core';

import { PageToolbar } from '../components/common/PageToolbar';
import { IconArrowLeft, IconEdit } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { DiagnosticSession } from '../features/diagnostics/DiagnosticSession';
import { useQuestionnaires } from '../features/diagnostics/useQuestionnaires';

export function QuestionnaireViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { questionnaires } = useQuestionnaires();
  const questionnaire = questionnaires.find((q) => q.id === id);

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
      <Stack gap="lg">
        <PageToolbar>
          <Group justify="space-between" wrap="wrap">
            <Button component={Link} to="/diagnostics" variant="subtle" leftSection={<IconArrowLeft size={16} />} pl={8}>
              К списку анкет
            </Button>
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/diagnostics/${questionnaire.id}/edit`)}>
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

        <DiagnosticSession diseases={questionnaire.diseases} symptoms={questionnaire.symptoms} />
      </Stack>
    </Container>
  );
}
