import { useMemo, useState } from 'react';
import { Button, Card, Container, Group, SimpleGrid, Stack, Text, TextInput, ThemeIcon } from '@mantine/core';
import { IconFileText, IconFileOff, IconPhotoScan, IconPlus, IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';

import { stripHtml } from '../../notes/textPreview';
import { useDocumentTemplates } from './useDocumentTemplates';

export function DocumentTemplatesPage() {
  const navigate = useNavigate();
  const { templates, isLoading } = useDocumentTemplates();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return templates;
    return templates.filter((t) => t.title.toLowerCase().includes(query));
  }, [templates, search]);

  return (
    <Container size="xl" px={0}>
      <Group justify="space-between" mb="lg" wrap="wrap" gap="md">
        <Text c="dimmed" size="sm">
          {templates.length} документов доступно
        </Text>
        <Group gap="sm">
          <Button
            variant="default"
            leftSection={<IconPhotoScan size={18} />}
            onClick={() => navigate('/patients/documents/scan')}
          >
            Бланк из снимка
          </Button>
          <Button leftSection={<IconPlus size={18} />} onClick={() => navigate('/patients/documents/new')}>
            Создать документ
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder="Поиск документа…"
        leftSection={<IconSearch size={16} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        mb="lg"
        w={300}
      />

      {!isLoading && filtered.length === 0 && (
        <Card withBorder padding="xl">
          <Stack align="center" gap="sm" py="xl">
            <ThemeIcon size={48} radius="xl" variant="light" color="gray">
              <IconFileOff size={24} />
            </ThemeIcon>
            <Text fw={600}>Ничего не найдено</Text>
            <Text size="sm" c="dimmed">
              Попробуйте изменить запрос или создайте новый документ.
            </Text>
          </Stack>
        </Card>
      )}

      {filtered.length > 0 && (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
          {filtered.map((template) => (
            <Card
              key={template.id}
              withBorder
              padding="lg"
              style={{ cursor: 'pointer', height: '100%' }}
              onClick={() => navigate(`/patients/documents/${template.id}/edit`)}
            >
              <ThemeIcon size={44} radius="md" variant="light" color="brand" mb="sm">
                {template.kind === 'layout' ? <IconPhotoScan size={22} /> : <IconFileText size={22} />}
              </ThemeIcon>
              <Text fw={600} size="md" mb={4}>
                {template.title}
              </Text>
              <Text size="sm" c="dimmed" lineClamp={2}>
                {template.kind === 'layout'
                  ? `Бланк из снимка, ${template.layout?.blocks.length ?? 0} блоков`
                  : stripHtml(template.bodyHtml) || 'Без текста'}
              </Text>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}
