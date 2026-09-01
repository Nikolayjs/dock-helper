import { Badge, Container, Tabs } from '@mantine/core';
import { IconFileText, IconRubberStamp } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';

import { PageToolbar } from '../../components/common/PageToolbar';
import { DocumentList } from './DocumentList';
import { useDoctorDocuments } from './useDoctorDocuments';
import { DocumentTemplatesPage } from '../patients/documents/DocumentTemplatesPage';
import { useDocumentTemplates } from '../patients/documents/useDocumentTemplates';

/**
 * Раздел «Документы»: две родственные, но разные сущности под одной крышей.
 *
 * **Бланки** — заготовки с подстановками: печатаются для конкретного пациента и визита, сами по
 * себе смысла не имеют. **Документы** — готовые бумаги, которые врач пишет сам; привязка к пациенту
 * у них необязательная, а формат для сохранения — Word или Excel.
 *
 * Вкладка живёт в адресе (`?tab=templates`), а не в состоянии компонента: иначе ссылка с дашборда
 * на частый бланк открывала бы не ту вкладку, а «назад» из бланка возвращало бы к документам.
 */
type DocumentsTab = 'documents' | 'templates';

function readTab(value: string | null): DocumentsTab {
  return value === 'templates' ? 'templates' : 'documents';
}

export function DocumentsSectionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = readTab(searchParams.get('tab'));

  const { documents } = useDoctorDocuments();
  const { templates } = useDocumentTemplates();

  const switchTab = (value: string | null) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (readTab(value) === 'templates') next.set('tab', 'templates');
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
          <Tabs.Tab
            value="documents"
            leftSection={<IconFileText size={16} />}
            rightSection={
              documents.length > 0 ? (
                <Badge size="xs" variant="light" color="gray" circle>
                  {documents.length}
                </Badge>
              ) : null
            }
          >
            Документы
          </Tabs.Tab>
          <Tabs.Tab
            value="templates"
            leftSection={<IconRubberStamp size={16} />}
            rightSection={
              templates.length > 0 ? (
                <Badge size="xs" variant="light" color="gray" circle>
                  {templates.length}
                </Badge>
              ) : null
            }
          >
            Бланки
          </Tabs.Tab>
        </Tabs.List>
          }
        />
      </Tabs>

      {/* Пояснение уехало внутрь панели соответствующей вкладки: отдельной строкой оно лежало на
          фоне страницы, а собственной карточкой стояло бы второй плитой над такой же. */}
      {tab === 'documents' ? (
        <DocumentList hint="Направления, справки и реестры, которые вы пишете сами. Скачиваются в Word и Excel." />
      ) : (
        <DocumentTemplatesPage hint="Заготовки с подстановками: печатаются для выбранного пациента и его последнего визита." />
      )}
    </Container>
  );
}
