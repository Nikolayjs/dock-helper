import { useMemo, type ReactNode } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Card,
  Container,
  Divider,
  Group,
  List,
  Stack,
  Text,
  ThemeIcon,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconHome2,
  IconInfoCircle,
  IconShieldOff,
  IconStethoscope,
  IconTargetArrow,
  IconVaccine,
} from '@tabler/icons-react';
import { Link, useParams } from 'react-router-dom';

import { BackButton } from '../../components/common/BackButton';
import { InlineBold } from '../../components/common/InlineBold';
import { PageLoader } from '../../components/common/PageLoader';
import { PageToolbar } from '../../components/common/PageToolbar';
import { ReadingSheet } from '../../components/common/ReadingSheet';
import { useIcd10Names } from '../patients/useIcd10Names';
import { intrinsicHit } from './cultureEngine';
import { groupLabel } from './labels';
import { useMicrobiologyReference, useOrganismProfile } from './useMicrobiology';

/**
 * Карточка возбудителя: подробный разбор плюс то, что о нём знает сам движок.
 *
 * Страница отвечает на вопрос, на который двух строк списка не хватает: **что это за микроб и что
 * делать, увидев его в бланке**. Разделов шесть, и порядок у них не произвольный — он повторяет
 * порядок вопросов врача: где он живёт (значит, откуда взялся) → что вызывает → значима ли находка
 * → к чему устойчив → чем лечить → на чём здесь ошибаются.
 *
 * **Проза и таблицы разведены намеренно.** Первые шесть разделов написаны руками и лежат в
 * `profiles/`; всё, что ниже подложки, — **вычислено из тех же таблиц, которыми разбирается бланк**:
 * где этот микроб нормальная флора, где контаминант, где безусловный патоген и какие правила
 * природной устойчивости к нему относятся. Пересказать это прозой значило бы завести второй
 * источник, который разошёлся бы с первым при первой правке справочника, — и справочник начал бы
 * обещать не то, что скажет разбор посева.
 *
 * По той же причине правила природной устойчивости раскрываются **функцией движка**
 * (`intrinsicHit`), а не своей копией её логики.
 */
export function OrganismPage() {
  const { key } = useParams<{ key: string }>();
  const { reference, isLoading: referenceLoading } = useMicrobiologyReference();
  const { profile, isLoading: profileLoading, error } = useOrganismProfile(key);

  const organism = reference?.organisms.find((row) => row.key === key);

  const names = useIcd10Names(profile?.icd10 ?? []);

  /**
   * Где этот микроб чем считается — по самим материалам, а не по отдельному списку.
   *
   * Локус называет свою флору, контаминантов и безусловных патогенов; обратной ссылки у возбудителя
   * нет и заводить её нельзя — это был бы второй источник той же связи.
   */
  const roles = useMemo(() => {
    if (!reference || !organism) return { flora: [], contaminant: [], pathogen: [] };
    const flora: string[] = [];
    const contaminant: string[] = [];
    const pathogen: string[] = [];
    for (const locus of reference.loci) {
      if (locus.flora.includes(organism.key)) flora.push(locus.label);
      if (locus.contaminants?.includes(organism.key)) contaminant.push(locus.label);
      if (locus.pathogens?.includes(organism.key)) pathogen.push(locus.label);
    }
    return { flora, contaminant, pathogen };
  }, [reference, organism]);

  /** Правила природной устойчивости — той же функцией, которой их применяет разбор бланка. */
  const intrinsic = useMemo(() => {
    if (!reference || !organism) return [];
    return reference.intrinsic
      .map((rule) => ({
        rule,
        drugs: reference.antibiotics.filter((antibiotic) => intrinsicHit(rule, organism, antibiotic)),
      }))
      .filter((row) => row.drugs.length > 0);
  }, [reference, organism]);

  if (referenceLoading || (profileLoading && !error)) return <PageLoader />;

  /*
   * «Не найдено» до того, как справочник приехал, — враньё, поэтому проверка стоит после загрузки.
   * В демо-режиме раздел недоступен целиком, и это тот же случай: сказать прямо честнее, чем
   * показать пустую карточку.
   */
  if (!organism || !profile) {
    return (
      <Container size="md" px={0}>
        <Stack gap="lg">
          <BackButton fallback={{ to: '/microbiology?tab=organisms', label: 'К возбудителям' }} />
          <Alert variant="light" color="gray" icon={<IconInfoCircle size={18} />}>
            Такого возбудителя в справочнике нет. В демо-режиме раздел недоступен — справочник живёт на сервере.
          </Alert>
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="md" px={0}>
      <Stack gap="lg">
        <PageToolbar>
          <BackButton fallback={{ to: '/microbiology?tab=organisms', label: 'К возбудителям' }} />
        </PageToolbar>

        <ReadingSheet>
          <Stack gap="lg">
            <Stack gap={4}>
              <Title order={2}>{organism.ru}</Title>
              <Text size="sm" c="dimmed" fs="italic">
                {organism.name}
              </Text>
              <Group gap={6} mt={4}>
                <Badge variant="light" color="gray">
                  {groupLabel(organism.group)}
                </Badge>
                {organism.gram && (
                  <Badge variant="light" color={organism.gram === 'positive' ? 'violet' : 'pink'}>
                    {organism.gram === 'positive' ? 'Грам +' : 'Грам −'}
                  </Badge>
                )}
              </Group>
            </Stack>

            <Text fw={500}>
              <InlineBold text={profile.summary} />
            </Text>

            <Section icon={<IconHome2 size={14} />} title="Где живёт и откуда берётся">
              <Text size="sm">
                <InlineBold text={profile.habitat} />
              </Text>
            </Section>

            <Section icon={<IconStethoscope size={14} />} title="Что вызывает">
              <Bullets items={profile.causes} />
            </Section>

            <Section icon={<IconTargetArrow size={14} />} title="Когда рост значим">
              <Text size="sm">
                <InlineBold text={profile.significance} />
              </Text>
            </Section>

            <Section icon={<IconShieldOff size={14} />} title="Устойчивость">
              <Text size="sm">
                <InlineBold text={profile.resistance} />
              </Text>
            </Section>

            <Section icon={<IconVaccine size={14} />} title="Чем лечат">
              <Text size="sm">
                <InlineBold text={profile.treatment} />
              </Text>
              <Text size="xs" c="dimmed" mt={6}>
                Доз здесь нет намеренно: они зависят от функции почек, веса и сопутствующей терапии — за ними в
                формуляр и в клиническую рекомендацию.
              </Text>
            </Section>

            <Section icon={<IconAlertTriangle size={14} />} title="На чём здесь ошибаются" color="orange">
              <Bullets items={profile.pitfalls} />
            </Section>
          </Stack>
        </ReadingSheet>

        {/*
          Ниже подложки — не проза, а то же, чем разбирается бланк. Отделено сознательно: врач
          должен видеть, где кончается написанное нами и начинается то, что применяет движок.
        */}
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Text fw={600} size="sm">
              Чем это оборачивается в разборе бланка
            </Text>

            <Stack gap={6}>
              <RoleRow label="Нормальная флора" values={roles.flora} empty="Нигде — всегда находка" />
              <RoleRow label="Попадает при заборе" values={roles.contaminant} empty="Контаминантом не считается нигде" />
              <RoleRow
                label="Значим при любом росте"
                values={roles.pathogen}
                empty="Безусловным патогеном не объявлен ни в одном материале"
              />
            </Stack>

            {intrinsic.length > 0 && (
              <>
                <Divider />
                <Text fw={600} size="sm">
                  Природная устойчивость — {intrinsic.length}{' '}
                  {intrinsic.length === 1 ? 'правило' : intrinsic.length < 5 ? 'правила' : 'правил'}
                </Text>
                <Text size="xs" c="dimmed">
                  Эти препараты не сработают, даже когда в бланке напечатано «чувствителен»: разбор помечает такие
                  строки расхождением.
                </Text>
                <List size="sm" spacing={8}>
                  {intrinsic.map(({ rule, drugs }) => (
                    <List.Item key={rule.id}>
                      <Text span fw={600} size="sm">
                        {drugs.map((drug) => drug.name).join(', ')}.
                      </Text>{' '}
                      <Text span size="sm">
                        <InlineBold text={rule.why} />
                      </Text>
                    </List.Item>
                  ))}
                </List>
              </>
            )}

            {(profile.icd10?.length ?? 0) > 0 && (
              <>
                <Divider />
                <Text fw={600} size="sm">
                  Коды МКБ-10
                </Text>
                <Text size="xs" c="dimmed">
                  Отсюда открывается остальной справочник: карточка кода ведёт к клиническим рекомендациям и к
                  заболеваниям этой рубрики.
                </Text>
                <Stack gap={4}>
                  {profile.icd10?.map((code) => (
                    <Anchor
                      key={code}
                      component={Link}
                      to={`/icd10/${encodeURIComponent(code)}`}
                      state={{ from: `/microbiology/organisms/${organism.key}` }}
                      size="sm"
                    >
                      {code}
                      {names[code.toUpperCase()] ? ` — ${names[code.toUpperCase()]}` : ''}
                    </Anchor>
                  ))}
                </Stack>
              </>
            )}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
}

function Section({
  icon,
  title,
  color,
  children,
}: {
  icon: ReactNode;
  title: string;
  color?: string;
  children: ReactNode;
}) {
  return (
    <Stack gap={6}>
      <Group gap={6}>
        <ThemeIcon size="sm" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <Text fw={600} size="sm">
          {title}
        </Text>
      </Group>
      {children}
    </Stack>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <List size="sm" spacing={6}>
      {items.map((item) => (
        <List.Item key={item}>
          <Text span size="sm">
            <InlineBold text={item} />
          </Text>
        </List.Item>
      ))}
    </List>
  );
}

/** Строка «где он чем считается». Пустое значение проговаривается словами, а не прочерком. */
function RoleRow({ label, values, empty }: { label: string; values: string[]; empty: string }) {
  return (
    <Group gap={8} align="flex-start" wrap="nowrap">
      <Text size="sm" c="dimmed" style={{ flexShrink: 0, minWidth: 190 }}>
        {label}
      </Text>
      <Text size="sm">{values.length > 0 ? values.join(', ') : <Text span c="dimmed" size="sm">{empty}</Text>}</Text>
    </Group>
  );
}
