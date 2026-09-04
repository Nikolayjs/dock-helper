import { Box, Container, Stack, Tabs } from '@mantine/core';

import { PageToolbar } from '../components/common/PageToolbar';
import { IconBook2, IconListSearch, IconStethoscope, IconVocabulary } from '@tabler/icons-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AbbreviationsCatalog } from '../features/abbreviations/AbbreviationsCatalog';
import { DiseasesCatalog } from '../features/diseases/DiseasesCatalog';
import { GuidelinesCatalog } from '../features/guidelines/GuidelinesCatalog';
import { Icd10Catalog } from '../features/icd10/Icd10Catalog';

const TABS = ['diseases', 'guidelines', 'abbreviations', 'icd10'] as const;
type ReferenceTab = (typeof TABS)[number];

/**
 * Справочник — полка коротких списков, к которым обращаются за одним ответом.
 *
 * Четыре вкладки, и все отвечают на вопрос «что это»: что за болезнь, что говорит о ней Минздрав,
 * что значит это сокращение, какой у неё код. За тремя из них стоит одна и та же нозология, и
 * ходят между ними постоянно — с карточки болезни в рекомендацию, из рекомендации в код.
 *
 * **Клинические рекомендации сюда переехали, и это смена прежнего решения.** Их держали отдельным
 * пунктом меню на том основании, что семьсот документов со своей читалкой — это раздел, а не
 * справка. Но пункт меню отвечает не на вопрос «сколько там документов», а на вопрос «за чем сюда
 * идут», и идут за тем же, за чем в справочник. Читалка при этом осталась своей страницей, как и
 * карточка кода МКБ-10: вкладка — это список, а документ вкладкой быть не может.
 *
 * Формуляр отдельным пунктом остался: рядом с ним вкладка «Взаимодействия», то есть проверка,
 * которая делается на приёме и обязана открываться в одно нажатие, а не в три.
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
      <Tabs variant="pills" value={tab} onChange={setTab} keepMounted={false}>
        {/* Вкладки лежат на поверхности, а не на фоне страницы: одно правило на все разделы. */}
        <Box mb="lg">
          <PageToolbar
            tabs={
        <Tabs.List>
          <Tabs.Tab value="diseases" leftSection={<IconStethoscope size={16} />}>
            Заболевания
          </Tabs.Tab>
          <Tabs.Tab value="guidelines" leftSection={<IconBook2 size={16} />}>
            Клинические рекомендации
          </Tabs.Tab>
          <Tabs.Tab value="abbreviations" leftSection={<IconVocabulary size={16} />}>
            Аббревиатуры
          </Tabs.Tab>
          <Tabs.Tab value="icd10" leftSection={<IconListSearch size={16} />}>
            МКБ-10
          </Tabs.Tab>
        </Tabs.List>
            }
          />
        </Box>

        {/* `keepMounted={false}` не для экономии памяти: МКБ-10 тянет свои 55 КБ оглавления, и
            держать их наготове у того, кто открыл вкладку с сокращениями, незачем. */}
        <Tabs.Panel value="diseases">
          <Stack gap="lg">
            <DiseasesCatalog
              onOpen={(row) => navigate(`/reference/diseases/${row.id}`)}
              onEdit={(row) => navigate(row ? `/reference/diseases/${row.id}/edit` : '/reference/diseases/new')}
            />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="guidelines">
          <GuidelinesCatalog />
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
