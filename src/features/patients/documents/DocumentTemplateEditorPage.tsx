import { useState } from 'react';
import { Button, Container, Group, Loader, Modal, Stack, Text, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconArrowLeft } from '@tabler/icons-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { DocumentTemplateForm } from './DocumentTemplateForm';
import { LayoutTemplateForm } from './LayoutTemplateForm';
import { useDocumentTemplates } from './useDocumentTemplates';
import type { DocumentTemplateInput } from './useDocumentTemplates';

export function DocumentTemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const { templates, isLoading, addTemplate, updateTemplate, deleteTemplate } = useDocumentTemplates();
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const editingTemplate = isEditMode ? templates.find((t) => t.id === id) : undefined;

  // The Tiptap editor in DocumentTemplateForm only reads `initialTemplate` once, on mount — it
  // doesn't pick up content that arrives after an async load, unlike plain useState fields. So
  // the form must not mount until we actually know whether there's data to hydrate it with.
  if (isEditMode && isLoading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
    );
  }

  if (isEditMode && !editingTemplate) {
    return (
      <Container size="md" px={0}>
        <Stack align="center" gap="sm" py={100}>
          <Text fw={600}>Документ не найден</Text>
          <Button component={Link} to="/patients/documents" mt="md">
            К шаблонам документов
          </Button>
        </Stack>
      </Container>
    );
  }

  const handleSubmit = async (input: DocumentTemplateInput) => {
    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, input);
      notifications.show({ message: 'Документ обновлён', color: 'teal' });
    } else {
      await addTemplate(input);
      notifications.show({ message: 'Документ создан', color: 'teal' });
    }
    navigate('/patients/documents');
  };

  const handleDelete = async () => {
    if (!editingTemplate) return;
    await deleteTemplate(editingTemplate.id);
    notifications.show({ message: 'Документ удалён', color: 'gray' });
    navigate('/patients/documents');
  };

  return (
    <Container size={editingTemplate?.kind === 'layout' ? 'xl' : 'md'} px={0}>
      <Stack gap="lg">
        <Button
          variant="subtle"
          color="gray"
          leftSection={<IconArrowLeft size={16} />}
          pl={8}
          style={{ alignSelf: 'flex-start' }}
          onClick={() => navigate('/patients/documents')}
        >
          К шаблонам документов
        </Button>

        <Title order={3}>{editingTemplate ? 'Редактирование документа' : 'Новый документ'}</Title>

        {/* A scanned form and a Tiptap document are edited by different tools. Opening a layout
            template in the rich-text form would show an empty editor and then overwrite the layout
            with that emptiness on save, so the branch is load-bearing, not cosmetic. */}
        {editingTemplate?.kind === 'layout' ? (
          <LayoutTemplateForm
            template={editingTemplate}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/patients/documents')}
            onDelete={() => setDeleteModalOpen(true)}
          />
        ) : (
          <DocumentTemplateForm
            initialTemplate={editingTemplate}
            onSubmit={handleSubmit}
            onCancel={() => navigate('/patients/documents')}
            onDelete={editingTemplate ? () => setDeleteModalOpen(true) : undefined}
          />
        )}
      </Stack>

      <Modal opened={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Удалить документ?" radius="lg" centered>
        <Text size="sm" mb="lg">
          Действие необратимо. Шаблон «{editingTemplate?.title}» будет удалён без возможности восстановления.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setDeleteModalOpen(false)}>
            Отмена
          </Button>
          <Button color="red" onClick={handleDelete}>
            Удалить
          </Button>
        </Group>
      </Modal>
    </Container>
  );
}
