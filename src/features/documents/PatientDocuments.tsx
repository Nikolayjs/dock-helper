import { Badge, Button, Card, Group, Menu, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconFilePlus, IconFileSpreadsheet, IconFileText } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';

import { PageSection } from '../../components/common/PageSection';
import { KIND_LABEL } from './types';
import { useDoctorDocuments } from './useDoctorDocuments';

/**
 * Документы пациента прямо в его карточке.
 *
 * Без этого связь окупалась бы только с одной стороны: документ знал бы про пациента, а врач, стоя в
 * карточке, не видел бы, что уже выписано. Ссылки уносят происхождение (`from`), поэтому «назад» из
 * документа возвращает в карточку, а не в общий список.
 */
export function PatientDocuments({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const { documents } = useDoctorDocuments();
  const patientPath = `/patients/${patientId}`;

  const own = documents.filter((doc) => doc.patientId === patientId);

  return (
    <PageSection
      title="Документы"
      action={
        <Menu position="bottom-end" withinPortal>
          <Menu.Target>
            <Button size="xs" variant="light" leftSection={<IconFilePlus size={14} />}>
              Создать документ
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Item
              leftSection={<IconFileText size={16} />}
              onClick={() => navigate(`/documents/new?kind=text&patient=${patientId}`, { state: { from: patientPath } })}
            >
              Документ Word
            </Menu.Item>
            <Menu.Item
              leftSection={<IconFileSpreadsheet size={16} />}
              onClick={() => navigate(`/documents/new?kind=sheet&patient=${patientId}`, { state: { from: patientPath } })}
            >
              Таблица Excel
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      }
    >
      {own.length === 0 ? (
        <Text size="sm" c="dimmed">
          Для этого пациента документов пока нет.
        </Text>
      ) : (
        <Stack gap="sm">
          {own.map((doc) => (
            <Card
              key={doc.id}
              withBorder
              padding="md"
              radius="md"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/documents/${doc.id}`, { state: { from: patientPath } })}
            >
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Group gap={10} wrap="nowrap" style={{ minWidth: 0 }}>
                  <ThemeIcon variant="light" color={doc.kind === 'sheet' ? 'teal' : 'brand'} size={32} radius="md">
                    {doc.kind === 'sheet' ? <IconFileSpreadsheet size={17} /> : <IconFileText size={17} />}
                  </ThemeIcon>
                  <div style={{ minWidth: 0 }}>
                    <Text fw={600} size="sm" truncate>
                      {doc.title}
                    </Text>
                    {doc.summary && (
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {doc.summary}
                      </Text>
                    )}
                  </div>
                </Group>
                <Group gap={8} wrap="nowrap">
                  <Badge size="xs" variant="light" color={doc.kind === 'sheet' ? 'teal' : 'brand'}>
                    {KIND_LABEL[doc.kind]}
                  </Badge>
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                    {dayjs(doc.updatedAt).format('D MMM YYYY')}
                  </Text>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </PageSection>
  );
}
