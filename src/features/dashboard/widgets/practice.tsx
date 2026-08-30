import { DonutChart } from '../../../components/common/LazyCharts';
import { Badge, Button, Group, SegmentedControl, Stack, Table, Text } from '@mantine/core';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';

import { REFERRAL_CATEGORY_COLORS, REFERRAL_CATEGORY_LABELS } from '../../patients/referralUtils';
import { CardHeading } from '../CardHeading';
import { DashboardCalendar } from '../DashboardCalendar';
import { PatientStructure } from '../PatientStructure';
import { isStructureMode, type StructureMode } from '../structureMode';
import linkClasses from '../dashboardLinks.module.css';
import type { DashboardWidget } from './types';

const REFERRAL_PERIOD_LABEL: Record<string, string> = {
  month: 'Месяц',
  quarter: 'Квартал',
  halfYear: 'Полугодие',
  year: 'Год',
};

/** Картина практики. */
export const PRACTICE_WIDGETS: DashboardWidget[] = [
  {
    id: 'structure',
    title: 'Структура пациентов',
    description: 'Диагнозы, возраст, пол — по выбору или всё сразу',
    span: 6,
    render: (ctx) => {
      const stored = ctx.widgetSettings.get('structure');
      const mode: StructureMode = stored && isStructureMode(stored) ? stored : 'diagnoses';
      return (
        <>
          <CardHeading
            title="Структура пациентов"
            caption={
              mode === 'diagnoses'
                ? 'Диагнозы по числу визитов; одинаковые коды МКБ сведены вместе'
                : 'Кого вы лечите — по данным карточек пациентов'
            }
          />
          <PatientStructure
            mode={mode}
            onModeChange={(next) => ctx.widgetSettings.set('structure', next)}
            diagnoses={ctx.topDiagnoses}
            age={ctx.ageDistribution}
            sex={ctx.sexDistribution}
            undatedCount={ctx.undatedCount}
          />
        </>
      );
    },
  },
  {
    id: 'calendar',
    title: 'Календарь',
    description: 'Месяц с отметками и что запланировано на выбранный день',
    span: 6,
    render: ({ allNotes, allReminders }) => (
      <>
        <CardHeading
          title="Календарь"
          action={
            <Button component={Link} to="/calendar" variant="subtle" size="xs">
              Открыть
            </Button>
          }
        />
        <DashboardCalendar notes={allNotes} reminders={allReminders} />
      </>
    ),
  },
  {
    id: 'referrals',
    title: 'Направления',
    description: 'Куда направляли пациентов за период',
    span: 12,
    render: ({ referrals }) => (
      <>
        <CardHeading
          title="Направления"
          caption={`${dayjs(referrals.range.start).format('D MMMM YYYY')} — ${dayjs(referrals.range.end).format('D MMMM YYYY')}`}
          action={
            <SegmentedControl
              value={referrals.period}
              onChange={(v) => referrals.setPeriod(v as typeof referrals.period)}
              data={Object.entries(REFERRAL_PERIOD_LABEL).map(([value, label]) => ({ value, label }))}
            />
          }
        />
        {referrals.total === 0 ? (
          <Text size="sm" c="dimmed">
            За выбранный период направлений не было. Добавьте направление в визите пациента.
          </Text>
        ) : (
          <Group align="flex-start" wrap="wrap" gap="xl">
            <Stack gap="xs" style={{ flex: '1 1 240px', minWidth: 220 }}>
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Всего направлений
                </Text>
                <Badge variant="light" color="brand" size="lg">
                  {referrals.total}
                </Badge>
              </Group>
              <DonutChart data={referrals.breakdown} h={180} withLabelsLine withLabels />
              <Stack gap={6} mt="sm">
                {referrals.breakdown.map((item) => (
                  <Group key={item.name} justify="space-between">
                    <Group gap={8}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: `var(--mantine-color-${item.color.replace('.', '-')})`,
                        }}
                      />
                      <Text size="sm">{item.name}</Text>
                    </Group>
                    <Text size="sm" c="dimmed">
                      {item.value}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </Stack>
            <div style={{ flex: '2 1 340px', minWidth: 300, overflowX: 'auto' }}>
              <Table verticalSpacing="sm" highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Пациент</Table.Th>
                    <Table.Th>Направление</Table.Th>
                    <Table.Th>Дата</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {referrals.entries.map((entry) => (
                    <Table.Tr key={entry.visitId}>
                      <Table.Td>
                        <Link
                          to={`/patients/${entry.patientId}`}
                          state={{ from: '/dashboard' }}
                          className={linkClasses.cell}
                        >
                          <Text size="sm" fw={500}>
                            {entry.patientName}
                          </Text>
                        </Link>
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={REFERRAL_CATEGORY_COLORS[entry.category]} size="sm">
                          {REFERRAL_CATEGORY_LABELS[entry.category]}
                          {entry.destination ? ` · ${entry.destination}` : ''}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm">{dayjs(entry.date).format('D MMMM')}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Group>
        )}
      </>
    ),
  },
];
