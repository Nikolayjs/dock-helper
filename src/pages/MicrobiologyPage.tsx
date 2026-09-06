import { useMemo, useState } from 'react';
import { Alert, Container, Grid, Stack, Tabs, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';

import { PageLoader } from '../components/common/PageLoader';
import { PageToolbar } from '../components/common/PageToolbar';
import { CultureForm } from '../features/microbiology/CultureForm';
import { CultureResults } from '../features/microbiology/CultureResults';
import { OrganismCatalog } from '../features/microbiology/OrganismCatalog';
import { interpretCulture } from '../features/microbiology/cultureEngine';
import { useMicrobiologyReference } from '../features/microbiology/useMicrobiology';
import type { CultureReport } from '../features/microbiology/types';

/**
 * Микробиология: разбор посева и справочник возбудителей.
 *
 * **Почему это отдельный раздел, а не панель анализатора.** Панель анализатора — это показатели с
 * нормами и правила над ними; посев устроен иначе: список изолятов, у каждого свой счёт и своя
 * таблица чувствительности. Уложить это в «показатель — норма» можно было бы только ценой сотен
 * рукописных правил вида «энтерококк и цефтриаксон», то есть таблицы, записанной ветвлениями, —
 * ровно та ошибка, от которой в диагностике отказались, разложив частоты по корзинам.
 *
 * Микроскопия мазка при этом осталась **панелью анализатора**, и это не разнобой: лейкоциты,
 * эпителий и флора в поле зрения — это числа с нормами, и второй движок для них был бы вторым
 * источником правды.
 *
 * Вкладка живёт в адресе (`?tab=organisms`), а не в состоянии: ссылка на справочник обязана
 * открывать справочник — та же причина, что в «Документах» и «Справочнике».
 */
export function MicrobiologyPage() {
  const { reference, isLoading, error } = useMicrobiologyReference();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'organisms' ? 'organisms' : 'culture';

  const [report, setReport] = useState<CultureReport>({
    locusKey: 'urine',
    noGrowth: false,
    context: [],
    isolates: [],
  });

  const verdict = useMemo(
    () => (reference ? interpretCulture(reference, report) : undefined),
    [reference, report],
  );

  const tabs = (
    <Tabs
      value={tab}
      variant="pills"
      onChange={(value) => {
        const next = new URLSearchParams(searchParams);
        if (value === 'organisms') next.set('tab', 'organisms');
        else next.delete('tab');
        setSearchParams(next, { replace: true });
      }}
    >
      <Tabs.List>
        <Tabs.Tab value="culture">Разбор посева</Tabs.Tab>
        <Tabs.Tab value="organisms">Возбудители</Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );

  if (isLoading) return <PageLoader />;

  /*
   * Без справочника толковать нечем, и молчать об этом нельзя: пустой разбор читался бы как
   * «бланк чист». Показать урезанную копию тоже нельзя — без части правил природной устойчивости
   * разбор объявил бы годным препарат, который не работает.
   */
  if (error || !reference || !verdict) {
    return (
      <Container size="xl">
        <Alert variant="light" color="orange" icon={<IconAlertTriangle size={16} />} title="Справочник не загрузился">
          <Text size="sm">
            Толковать посев без справочника возбудителей и природной устойчивости нельзя: разбор объявил бы годным
            препарат, который не работает. В демо-режиме раздел недоступен — справочник живёт на сервере.
          </Text>
        </Alert>
      </Container>
    );
  }

  if (tab === 'organisms') {
    return (
      <Container size="xl">
        <OrganismCatalog reference={reference} tabs={tabs} />
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Stack gap="md">
        <PageToolbar tabs={tabs}>
          <Text size="sm" c="dimmed">
            Перенесите бланк из лаборатории, и разбор скажет три вещи: значим ли рост, не противоречит ли
            антибиотикограмма природной устойчивости и нужно ли лечение вообще.
          </Text>
        </PageToolbar>

        <Grid gutter="md">
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <CultureForm reference={reference} report={report} onChange={setReport} />
          </Grid.Col>
          <Grid.Col span={{ base: 12, lg: 6 }}>
            <CultureResults verdict={verdict} />
          </Grid.Col>
        </Grid>
      </Stack>
    </Container>
  );
}
