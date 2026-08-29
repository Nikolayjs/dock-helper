import { useMemo } from 'react';
import { Button, Card, Container, Group, Stack, Text } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useNavigate } from 'react-router-dom';

import { GraphView } from '../features/knowledgeBase/GraphView';
import { buildKnowledgeGraph } from '../features/knowledgeBase/knowledgeGraph';
import type { GraphNode } from '../features/knowledgeBase/knowledgeGraph';
import { useAllDocumentsWithContent } from '../features/knowledgeBase/useDocuments';

export function KnowledgeGraphPage() {
  // Рёбра строятся по ссылкам `[[Название]]` внутри документов, поэтому здесь — единственное
  // место, где список запрашивается вместе с текстами.
  const { documents } = useAllDocumentsWithContent();
  const navigate = useNavigate();

  const { nodes, edges } = useMemo(() => buildKnowledgeGraph(documents), [documents]);

  const handleOpen = (node: GraphNode) => {
    navigate(node.kind === 'guideline' ? `/guidelines/${node.id}` : `/articles/${node.id}`);
  };

  return (
    <Container size="xl" px={0}>
      <Stack gap="lg">
        <Group justify="space-between" wrap="wrap">
          <Button component={Link} to="/guidelines" variant="subtle" color="gray" leftSection={<IconArrowLeft size={16} />} pl={8}>
            К базе знаний
          </Button>

          <Group gap="lg" wrap="wrap">
            <Group gap={6}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--mantine-color-brand-6)', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">
                Рекомендации
              </Text>
            </Group>
            <Group gap={6}>
              <span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--mantine-color-mint-6)', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">
                Статьи
              </Text>
            </Group>
            <Group gap={6}>
              <span style={{ width: 16, height: 2, background: 'var(--mantine-color-brand-5)', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">
                Ссылка [[…]]
              </Text>
            </Group>
            <Group gap={6}>
              <span style={{ width: 16, height: 0, borderTop: '1px dashed var(--mantine-color-gray-5)', display: 'inline-block' }} />
              <Text size="xs" c="dimmed">
                Общие теги
              </Text>
            </Group>
          </Group>
        </Group>

        {nodes.length === 0 ? (
          <Card withBorder padding="xl">
            <Stack align="center" gap="sm" py="xl">
              <Text fw={600}>Пока нечего показывать</Text>
              <Text size="sm" c="dimmed" ta="center" maw={420}>
                Добавьте рекомендации или статьи, отметьте их тегами или сошлитесь друг на друга через{' '}
                <Text span ff="monospace">
                  [[Название заметки]]
                </Text>{' '}
                в тексте — тогда здесь появятся связи.
              </Text>
            </Stack>
          </Card>
        ) : (
          <Card withBorder padding={0} h="calc(100vh - 240px)" mih={480}>
            <GraphView nodes={nodes} edges={edges} onOpen={handleOpen} />
          </Card>
        )}
      </Stack>
    </Container>
  );
}
