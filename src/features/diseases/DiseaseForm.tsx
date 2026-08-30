import { useState } from 'react';
import { Button, Group, Select, Stack, TagsInput, TextInput } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';

import { FormActions } from '../../components/common/FormActions';
import { RichTextField } from '../../components/common/RichTextField';
import { useDirtyValue, useEditorDirty, useUnsavedGuard } from '../../components/common/unsavedChanges';
import { useRichTextEditor } from '../../components/common/useRichTextEditor';
import { useSaveAction } from '../../components/common/useSaveAction';
import { descriptionToHtml } from './description';
import type { Disease, DiseaseInput } from './types';

/**
 * Форма заболевания — с полноценным редактором описания.
 *
 * Описание правится тем же редактором, что статьи и клинические рекомендации, и это не роскошь.
 * Текст про болезнь приносят готовым — из руководства, из методички, из Википедии, — а там он
 * разбит на разделы: этиология, патогенез, клиника, диагностика. Простое текстовое поле сминает
 * это в один ком: заголовки становятся обычными строками, списки — строками с дефисом, таблица
 * дозирования — мешаниной. Прочитать такое можно, но пользоваться им как справкой уже нельзя.
 *
 * **Отсюда же и страница вместо окна.** У сокращений форма осталась окном — там четыре коротких
 * поля; здесь редактор занимает половину экрана, и в окне ему тесно ровно настолько, насколько
 * длинный текст и не помещается в окно.
 */
interface Props {
  initial?: Disease;
  sections: string[];
  onSubmit: (input: DiseaseInput) => void | Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}

export function DiseaseForm({ initial, sections, onSubmit, onCancel, onDelete }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [synonyms, setSynonyms] = useState<string[]>(initial?.synonyms ?? []);
  const [icdCodes, setIcdCodes] = useState<string[]>(initial?.icdCodes ?? []);
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [category, setCategory] = useState(initial?.category ?? '');

  // Через `descriptionToHtml`: запись, сделанная до редактора, — обычный текст, и без этого
  // первое же сохранение склеило бы её абзацы навсегда.
  const editor = useRichTextEditor(descriptionToHtml(initial?.description ?? ''));

  const canSave = name.trim().length > 0;

  const fieldsDirty = useDirtyValue({ name, synonyms, icdCodes, summary, category });
  const textDirty = useEditorDirty(editor);
  const guard = useUnsavedGuard(fieldsDirty || textDirty);
  const { saving, save } = useSaveAction(guard, onSubmit);

  const handleSubmit = () => {
    if (!canSave || !editor) return;
    void save({
      name: name.trim(),
      synonyms: synonyms.map((s) => s.trim()).filter(Boolean),
      // Коды приводятся к верхнему регистру: врач наберёт «j44», а ссылка на карточку кода
      // собирается из этой самой строки.
      icdCodes: icdCodes.map((c) => c.trim().toUpperCase()).filter(Boolean),
      summary: summary.trim(),
      description: editor.getHTML(),
      category: category.trim(),
    });
  };

  return (
    <Stack gap="md">
      <TextInput
        label="Название"
        placeholder="Хронический бронхит"
        required
        value={name}
        onChange={(e) => setName(e.currentTarget.value)}
      />
      <TagsInput
        label="Синонимы"
        description="Прежнее название, разговорное, аббревиатура — то, как болезнь называют"
        placeholder="Enter — добавить"
        value={synonyms}
        onChange={setSynonyms}
      />
      <TagsInput
        label="Коды МКБ-10"
        description="Можно несколько: болезнь часто кодируется группой рубрик"
        placeholder="J41, J42"
        value={icdCodes}
        onChange={setIcdCodes}
      />
      <Select
        label="Раздел"
        placeholder="без раздела"
        data={sections}
        value={category || null}
        onChange={(next) => setCategory(next ?? '')}
        searchable
        clearable
        allowDeselect={false}
      />
      <TextInput
        label="Суть"
        description="Одна строка: что это. Видна в списке"
        value={summary}
        onChange={(e) => setSummary(e.currentTarget.value)}
      />

      <RichTextField
        editor={editor}
        exportTitle={name}
        hint="Разделы, списки и таблицы сохраняются при вставке: текст из руководства не сминается в один ком. Обновления справочника ваше описание не затирают."
      />

      <FormActions>
        <Group justify="space-between" mt="sm">
          {initial && onDelete ? (
            <Button variant="subtle" color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
              Удалить
            </Button>
          ) : (
            <div />
          )}
          <Group gap="sm">
            <Button variant="default" onClick={onCancel}>
              Отмена
            </Button>
            {/* Кнопки нет, пока сохранять нечего: обещать сохранение и ничего не сохранить хуже,
                чем не обещать — на этом же правиле стоит окно несохранённых изменений. */}
            <Button onClick={handleSubmit} disabled={!canSave} loading={saving}>
              Сохранить
            </Button>
          </Group>
        </Group>
      </FormActions>

      {/* Окно «изменения не сохранены» рисует сама форма. Забыть эту строку — не значит остаться
          без охраны: `useBlocker` переход всё равно **запрещает**, и кнопка «Назад» тогда просто
          перестаёт работать, ничего не объясняя. Поймано прогоном. */}
      {guard.render({ onSave: canSave ? handleSubmit : undefined })}
    </Stack>
  );
}
