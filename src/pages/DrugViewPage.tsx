import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Badge, Button, Card, Container, Divider, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconEdit, IconPill, IconPlus, IconTestPipe, IconTrash } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { buildDrugIndex, normalizeDrugName } from '../features/drugs/drugIndex';
import { DRUG_TEXT_FIELDS } from '../features/drugs/types';
import type { Drug, DrugSummary } from '../features/drugs/types';
import { QUERY_KEY as DRUGS_KEY, useDrug, useDrugs } from '../features/drugs/useDrugs';
import { InteractionForm } from '../features/interactions/InteractionForm';
import { interactionsForDrug, otherDrugIn } from '../features/interactions/interactionEngine';
import { SEVERITY_COLOR, SEVERITY_LABELS } from '../features/interactions/types';
import { useDrugInteractions } from '../features/interactions/useDrugInteractions';
import { useDeleteWithConfirm } from '../features/deletion/deleteConfirmContext';
import { BackButton } from '../components/common/BackButton';

export function DrugViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { drugs, deleteDrug } = useDrugs();
  // Список отдаёт только имена — простыни показаний и противопоказаний тянем по id,
  // и только для той карточки, которую действительно открыли.
  const { drug, isLoading } = useDrug(id);
  const confirmDelete = useDeleteWithConfirm();
  const { interactions } = useDrugInteractions();

  const index = useMemo(() => buildDrugIndex(drugs), [drugs]);
  const related = useMemo(() => (drug ? interactionsForDrug(drug, interactions, index) : []), [drug, interactions, index]);

  if (isLoading) {
    return (
      <Container size="md" px={0}>
        <Group justify="center" py={100}>
          <Loader />
        </Group>
      </Container>
    );
  }

  if (!drug) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Препарат не найден</Text>
          <Button component={Link} to="/drugs" mt="md">
            К справочнику
          </Button>
        </Stack>
      </Container>
    );
  }

  const handleDelete = () =>
    confirmDelete({
      what: 'препарат',
      name: drug.inn,
      notice: 'Препарат удалён из справочника',
      queryKey: DRUGS_KEY,
      id: drug.id,
      perform: () => deleteDrug(drug.id),
      onConfirmed: () => navigate('/drugs'),
    });

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <BackButton fallback={{ to: '/drugs', label: 'К справочнику' }} />
          <Group gap="xs">
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={handleDelete}>
              Удалить
            </Button>
            <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => navigate(`/drugs/${drug.id}/edit`)}>
              Редактировать
            </Button>
          </Group>
        </Group>

        <div>
          <Title order={2}>{drug.inn}</Title>
          <Group gap={6} mt={10} wrap="wrap">
            {drug.category && (
              <Badge variant="filled" color="brand" tt="none">
                {drug.category}
              </Badge>
            )}
            {drug.pharmGroup && (
              <Badge variant="light" color="brand" tt="none">
                {drug.pharmGroup}
              </Badge>
            )}
            {drug.atcCode && <Badge variant="default" tt="none">ATC {drug.atcCode}</Badge>}
          </Group>
          <Text size="xs" c="dimmed" mt={8}>
            Обновлён {dayjs(drug.updatedAt).format('D MMMM YYYY')}
          </Text>
        </div>

        {/* The card that used to wrap every field turned a monograph into a stack of boxes. An
            article reads as one document with headings, and so should this. */}
        {drug.brandNames.length > 0 && (
          <Section title="Торговые названия">
            <Group gap={6} wrap="wrap">
              {drug.brandNames.map((brand) => (
                <Badge key={brand} variant="light" color="gray" size="lg" radius="sm" tt="none">
                  {brand}
                </Badge>
              ))}
            </Group>
            <Text size="xs" c="dimmed" mt={8}>
              Проверка взаимодействий понимает любое из этих названий как «{drug.inn}».
            </Text>
          </Section>
        )}

        {drug.forms.length > 0 && (
          <Section title="Формы выпуска">
            <Group gap={6} wrap="wrap">
              {drug.forms.map((form) => (
                <Badge key={form} variant="default" size="lg" radius="sm" tt="none">
                  {form}
                </Badge>
              ))}
            </Group>
          </Section>
        )}

        {DRUG_TEXT_FIELDS.filter(({ key }) => (drug[key] as string).trim()).map(({ key, label }) => (
          <Section key={key} title={label}>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }} lh={1.6}>
              {drug[key] as string}
            </Text>
          </Section>
        ))}

        <Divider mt="xs" />

        <InteractionsSection drug={drug} drugs={drugs} related={related} index={index} />
      </Stack>
    </Container>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <Title order={4} mb={8}>
        {title}
      </Title>
      {children}
    </div>
  );
}

function InteractionsSection({
  drug,
  drugs,
  related,
  index,
}: {
  drug: Drug;
  drugs: DrugSummary[];
  related: ReturnType<typeof interactionsForDrug>;
  index: ReturnType<typeof buildDrugIndex>;
}) {
  const navigate = useNavigate();
  const { addInteraction } = useDrugInteractions();
  const [addOpen, setAddOpen] = useState(false);

  // Rules are written in МНН, so that is what the form completes against.
  const innOptions = useMemo(
    () => drugs.map((item) => item.inn).sort((a, b) => a.localeCompare(b, 'ru')),
    [drugs],
  );

  return (
    <div>
      <Group justify="space-between" mb={10} wrap="wrap" gap="xs">
        <Group gap={8}>
          <IconAlertTriangle size={18} />
          <Title order={4}>Взаимодействия ({related.length})</Title>
        </Group>
        <Group gap="xs" wrap="wrap">
          {/* Noticing an interaction happens while reading about one of the drugs, so the rule can
              be written here, with this drug already filled in. */}
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setAddOpen(true)}>
            Добавить взаимодействие
          </Button>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconTestPipe size={14} />}
            onClick={() => navigate(`/interactions?drugs=${encodeURIComponent(drug.inn)}`)}
          >
            Проверить с другими препаратами
          </Button>
        </Group>
      </Group>

      {related.length === 0 ? (
        <Alert variant="light" color="gray" icon={<IconPill size={16} />}>
          В списке проверки нет правил с участием этого препарата. Это не значит, что взаимодействий не
          существует — список охватывает ограниченный набор хорошо известных пар.
        </Alert>
      ) : (
        <Stack gap="xs">
          {related.map((interaction) => {
            const other = otherDrugIn(interaction, drug, index);
            const otherDrug = index.byInn.get(normalizeDrugName(other));
            return (
              <Card key={interaction.id} withBorder padding="sm" radius="sm">
                <Group gap={8} mb={4} wrap="wrap">
                  <Badge size="sm" color={SEVERITY_COLOR[interaction.severity]} variant="filled">
                    {SEVERITY_LABELS[interaction.severity]}
                  </Badge>
                  {otherDrug ? (
                    <Text
                      size="sm"
                      fw={600}
                      c="brand"
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/drugs/${otherDrug.id}`)}
                    >
                      {other}
                    </Text>
                  ) : (
                    <Text size="sm" fw={600}>
                      {other}
                    </Text>
                  )}
                </Group>
                <Text size="sm">{interaction.mechanism}</Text>
                <Text size="sm" fw={500} mt={4}>
                  Рекомендация: {interaction.recommendation}
                </Text>
              </Card>
            );
          })}
        </Stack>
      )}

      <Modal
        opened={addOpen}
        onClose={() => setAddOpen(false)}
        title={`Взаимодействие с «${drug.inn}»`}
        radius="lg"
        size="lg"
        centered
      >
        <InteractionForm
          innOptions={innOptions}
          initial={{ drugA: drug.inn }}
          onSubmit={addInteraction}
          onSaved={() => setAddOpen(false)}
        />
      </Modal>
    </div>
  );
}
