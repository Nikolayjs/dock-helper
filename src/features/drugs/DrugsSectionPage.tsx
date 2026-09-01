import { Container, Tabs } from '@mantine/core';

import { PageToolbar } from '../../components/common/PageToolbar';
import { IconPill, IconPills } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';

import { DrugCatalog } from './DrugCatalog';
import { InteractionsCheck } from '../interactions/InteractionsCheck';

/**
 * Раздел «Лекарственные препараты»: справочник и проверка взаимодействий под одной крышей.
 *
 * Это две стороны одной картотеки, а не два раздела. Правила взаимодействий написаны на МНН, а
 * пациент называет торговое название — связывает их та самая карточка препарата, и разнесённые по
 * разным пунктам меню они выглядели как несвязанные инструменты. Вдобавок половина пути между ними
 * ходила ссылками: с карточки препарата — в проверку с подставленным МНН, из проверки — обратно в
 * справочник кнопкой. Теперь это переключение вкладки.
 *
 * Вкладка живёт в адресе (`?tab=interactions`), а не в состоянии компонента, — по той же причине,
 * что и в разделе «Документы»: ссылка обязана открывать ту вкладку, про которую она была. На неё
 * же ведёт старый адрес `/interactions`, вместе со строкой запроса: `?drugs=<МНН>` с карточки
 * препарата теряться не должен.
 */
type DrugsTab = 'catalog' | 'interactions';

function readDrugsTab(value: string | null): DrugsTab {
  return value === 'interactions' ? 'interactions' : 'catalog';
}

export function DrugsSectionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readDrugsTab(searchParams.get('tab'));

  const switchTab = (value: string | null) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (readDrugsTab(value) === 'interactions') next.set('tab', 'interactions');
        else next.delete('tab');
        return next;
      },
      { replace: true },
    );
  };

  return (
    <Container size="xl" px={0}>
      <Tabs variant="pills" value={tab} onChange={switchTab} mb="lg">
        {/* Вкладки на поверхности, как во всех разделах: см. `PageToolbar`. */}
        <PageToolbar
          tabs={
        <Tabs.List>
          {/* Без счётчиков: полторы тысячи препаратов и тысяча правил — числа, от которых врач
              ничего не делает иначе, а в круглом значке они к тому же не помещаются («1..»).
              Сколько препаратов в справочнике, страница и так пишет под вкладками. */}
          <Tabs.Tab value="catalog" leftSection={<IconPill size={16} />}>
            Справочник
          </Tabs.Tab>
          <Tabs.Tab value="interactions" leftSection={<IconPills size={16} />}>
            Взаимодействия
          </Tabs.Tab>
        </Tabs.List>
          }
        />
      </Tabs>

      {tab === 'catalog' ? <DrugCatalog /> : <InteractionsCheck />}
    </Container>
  );
}
