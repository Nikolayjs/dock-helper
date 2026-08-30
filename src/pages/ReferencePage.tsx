import { Container, Stack, Tabs } from '@mantine/core';
import { IconListSearch, IconStethoscope, IconVocabulary } from '@tabler/icons-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AbbreviationsCatalog } from '../features/abbreviations/AbbreviationsCatalog';
import { DiseasesCatalog } from '../features/diseases/DiseasesCatalog';
import { Icd10Catalog } from '../features/icd10/Icd10Catalog';

const TABS = ['diseases', 'abbreviations', 'icd10'] as const;
type ReferenceTab = (typeof TABS)[number];

/**
 * Справочник — полка коротких списков, к которым обращаются за одним ответом.
 *
 * Здесь три вкладки, и подобраны они по одному признаку: **у каждой один вопрос и один ответ**.
 * «Что это за болезнь», «что значит это сокращение», «какой у неё код». Клинические рекомендации и
 * формуляр остались отдельными пунктами меню намеренно: первое — двести документов со своим
 * редактором, второе — инструмент проверки взаимодействий, который делается на приёме и обязан
 * открываться в одно нажатие, а не в три.
 *
 * **Вкладка живёт в адресе** (`?tab=abbreviations`), как в разделах «Документы» и «Препараты»:
 * иначе ссылка с дашборда открывала бы не ту вкладку, ради которой её и давали.
 */
export function ReferencePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  const raw = params.get('tab');
  const tab: ReferenceTab = TABS.includes(raw as ReferenceTab) ? (raw as ReferenceTab) : 'diseases';

  const setTab = (next: string | null) => {
    const value = TABS.includes(next as ReferenceTab) ? (next as ReferenceTab) : 'diseases';
    // `replace`, чтобы переключение вкладок не заваливало историю: кнопка «назад» должна уводить
    // из раздела, а не перебирать вкладки, по которым врач прошёлся.
    setParams(value === 'diseases' ? {} : { tab: value }, { replace: true });
  };

  return (
    <Container size="xl" px={0}>
      <Tabs value={tab} onChange={setTab} keepMounted={false}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="diseases" leftSection={<IconStethoscope size={16} />}>
            Заболевания
          </Tabs.Tab>
          <Tabs.Tab value="abbreviations" leftSection={<IconVocabulary size={16} />}>
            Аббревиатуры
          </Tabs.Tab>
          <Tabs.Tab value="icd10" leftSection={<IconListSearch size={16} />}>
            МКБ-10
          </Tabs.Tab>
        </Tabs.List>

        {/* `keepMounted={false}` не для экономии памяти: МКБ-10 тянет свои 55 КБ оглавления, и
            держать их наготове у того, кто открыл вкладку с сокращениями, незачем. */}
        <Tabs.Panel value="diseases">
          <Stack gap="lg">
            <DiseasesCatalog onOpen={(row) => navigate(`/reference/diseases/${row.id}`)} />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="abbreviations">
          <AbbreviationsCatalog />
        </Tabs.Panel>
        <Tabs.Panel value="icd10">
          <Icd10Catalog />
        </Tabs.Panel>
      </Tabs>
    </Container>
  );
}
