import { useMemo, useState } from 'react';
import { Badge, Button, Card, Container, Group, Modal, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconAlertTriangle,
  IconCalendarCheck,
  IconClipboardHeart,
  IconClockExclamation,
  IconStethoscope,
  IconSunHigh,
} from '@tabler/icons-react';
import dayjs from 'dayjs';
import { Link, useNavigate } from 'react-router-dom';

import { PageSection } from '../../components/common/PageSection';
import { QueryState } from '../../components/common/QueryState';
import { useDispensary } from '../patients/useDispensary';
import type { Patient } from '../patients/types';
import { usePatients } from '../patients/usePatients';
import type { VisitInput } from '../patients/usePatients';
import { calcAge, formatAge } from '../patients/utils';
import { suggestedDiagnosis } from '../patients/suggestDiagnosis';
import { useIsMobile } from '../../components/common/useIsMobile';
import { VisitForm } from '../patients/VisitForm';
import { getSeenToday, getTodayQueue } from './todayQueue';
import type { TodayEntry } from './todayQueue';

/** «Просрочено на 9 дней» или «сегодня» — словами, потому что число дней само по себе ни о чём. */
function lateness(daysLate: number): { label: string; color: string } {
  if (daysLate <= 0) return { label: 'сегодня', color: 'orange' };
  if (daysLate === 1) return { label: 'просрочено на день', color: 'red' };
  return { label: `просрочено на ${daysLate} дн.`, color: 'red' };
}

function QueueRow({ entry, onReceive }: { entry: TodayEntry; onReceive: (patient: Patient) => void }) {
  const { patient } = entry;
  const age = calcAge(patient.birthDate);
  const status = lateness(entry.daysLate);

  return (
    <Card withBorder padding="md" radius="md">
      <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
        <Stack gap={4} style={{ minWidth: 0, flex: 1 }}>
          <Group gap={8} wrap="wrap">
            <Text
              component={Link}
              to={`/patients/${patient.id}`}
              state={{ from: '/today' }}
              fw={600}
              size="sm"
              td="none"
              c="inherit"
            >
              {patient.fullName}
            </Text>
            {age !== null && (
              <Text size="sm" c="dimmed">
                {formatAge(age)}
              </Text>
            )}
            <Badge variant="light" color={status.color} size="sm">
              {status.label}
            </Badge>
            {/* Аллергия видна до того, как врач начал приём: назначать будут здесь же. */}
            {patient.allergies && (
              <Badge variant="light" color="red" size="sm" leftSection={<IconAlertTriangle size={12} />}>
                Аллергия: {patient.allergies}
              </Badge>
            )}
          </Group>
          {entry.reasons.map((reason, index) => (
            <Group key={index} gap={6} wrap="nowrap">
              <ThemeIcon size={18} radius="sm" variant="light" color={reason.kind === 'dispensary' ? 'grape' : 'brand'}>
                {reason.kind === 'dispensary' ? <IconClipboardHeart size={12} /> : <IconClockExclamation size={12} />}
              </ThemeIcon>
              <Text size="sm" c="dimmed">
                {reason.kind === 'dispensary' ? 'Диспансерная явка' : 'Напоминание'}
                {reason.text ? ` · ${reason.text}` : ''}
              </Text>
            </Group>
          ))}
        </Stack>
        <Button size="xs" leftSection={<IconStethoscope size={14} />} onClick={() => onReceive(patient)}>
          Принять
        </Button>
      </Group>
    </Card>
  );
}

/**
 * «Мой день»: кто сегодня, что с ними и приём в одно нажатие.
 *
 * Место, которого не хватало: и напоминания, и диспансерные явки лежали по своим разделам, а
 * утренний вопрос «кого я сегодня жду» требовал обойти оба и свести их в голове.
 *
 * Список **убывает к концу приёма**: принятый сегодня уходит из «ждут» в «приняты». Ради этого
 * кнопка «Принять» и заводит визит прямо здесь — иначе пришлось бы уходить в карточку и
 * возвращаться, а на приёме это ровно та помеха, из-за которой визиты не заводят вовсе.
 */
export function TodayPage() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { patients, isLoading, error, refetch, addVisit } = usePatients();
  const { records } = useDispensary();
  const [receiving, setReceiving] = useState<Patient | null>(null);

  const queue = useMemo(() => getTodayQueue(patients, records), [patients, records]);
  const seen = useMemo(() => getSeenToday(patients), [patients]);


  const handleSave = async (input: VisitInput) => {
    if (!receiving) return;
    await addVisit(receiving.id, input);
    notifications.show({ message: `Визит добавлен: ${receiving.fullName}`, color: 'teal' });
    setReceiving(null);
  };

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <Group gap="md" align="center" wrap="nowrap">
          <ThemeIcon size={44} radius="md" variant="light" color="brand">
            <IconSunHigh size={24} />
          </ThemeIcon>
          <div>
            <Title order={3}>Мой день</Title>
            <Text size="sm" c="dimmed">
              {dayjs().format('dddd, D MMMM YYYY')}
            </Text>
          </div>
        </Group>

        <QueryState isLoading={isLoading} error={error} onRetry={refetch} what="пациентов">
          <Stack gap="lg">
            <PageSection
              title={queue.length > 0 ? `Ждут сегодня · ${queue.length}` : 'Ждут сегодня'}
              action={
                <Button size="xs" variant="light" onClick={() => navigate('/patients')}>
                  К картотеке
                </Button>
              }
            >
              {queue.length === 0 ? (
                <Text size="sm" c="dimmed">
                  На сегодня никого не запланировано: ни напоминаний, ни диспансерных явок. Просроченные
                  тоже показались бы здесь.
                </Text>
              ) : (
                <Stack gap="sm">
                  {queue.map((entry) => (
                    <QueueRow key={entry.patient.id} entry={entry} onReceive={setReceiving} />
                  ))}
                </Stack>
              )}
            </PageSection>

            {/* Приняты — это сделанное за день, поэтому раздел показывается, только когда есть что
                показать: пустая плашка «сегодня никого не приняли» с утра говорит очевидное. */}
            {seen.length > 0 && (
              <PageSection title={`Приняты сегодня · ${seen.length}`}>
                <Stack gap="sm">
                  {seen.map(({ patient, visit }) => (
                    <Card key={visit.id} withBorder padding="md" radius="md">
                      <Group gap={8} wrap="wrap">
                        <ThemeIcon size={18} radius="sm" variant="light" color="teal">
                          <IconCalendarCheck size={12} />
                        </ThemeIcon>
                        <Text
                          component={Link}
                          to={`/patients/${patient.id}`}
                          state={{ from: '/today' }}
                          fw={600}
                          size="sm"
                          td="none"
                          c="inherit"
                        >
                          {patient.fullName}
                        </Text>
                        {visit.diagnosis && (
                          <Badge variant="light" color="brand" size="sm">
                            {visit.diagnosisCode ? `${visit.diagnosisCode} · ${visit.diagnosis}` : visit.diagnosis}
                          </Badge>
                        )}
                      </Group>
                      {visit.note && (
                        <Text size="sm" c="dimmed" mt={4}>
                          {visit.note}
                        </Text>
                      )}
                    </Card>
                  ))}
                </Stack>
              </PageSection>
            )}
          </Stack>
        </QueryState>
      </Stack>

      <Modal
        opened={receiving !== null}
        onClose={() => setReceiving(null)}
        title={receiving ? `Приём: ${receiving.fullName}` : 'Приём'}
        size="lg"
        radius="md"
        fullScreen={isMobile}
      >
        {receiving && (
          <VisitForm
            key={receiving.id}
            initialVisit={{
              id: '',
              date: dayjs().format('YYYY-MM-DD'),
              ...suggestedDiagnosis(receiving, records),
              note: '',
              referralCategory: null,
              referralDestination: '',
              createdAt: '',
            }}
            onSubmit={handleSave}
            onCancel={() => setReceiving(null)}
          />
        )}
      </Modal>
    </Container>
  );
}
