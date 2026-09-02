import { useState } from 'react';
import { Alert, Button, Card, FileButton, Group, Stack, Text, ThemeIcon, Tooltip } from '@mantine/core';
import { IconDeviceMobile, IconUpload } from '@tabler/icons-react';
import { Link } from 'react-router-dom';

import { putFile } from './bookFiles';
import { sha256Of } from './bookSource';
import type { Book } from './types';

interface MissingBookFileProps {
  book: Book;
  onRestored: () => void;
}

/**
 * «Файл этой книги на другом устройстве».
 *
 * Полка общая, файлы — нет: книгу добавили с рабочего компьютера, а открыли с телефона. Экран
 * предлагает единственное, что тут можно сделать, — выбрать тот же файл.
 *
 * **Сверка по отпечатку, а не по имени.** Совпал — файл встаёт на место, и прогресс, заметки и
 * обложка остаются те же, потому что запись та же самая. Не совпал — это другая книга, и молча
 * подставить её вместо этой значило бы соврать про прогресс: «страница 148» относилась бы к
 * другому изданию.
 */
export function MissingBookFile({ book, onRestored }: MissingBookFileProps) {
  const [checking, setChecking] = useState(false);
  const [mismatch, setMismatch] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const accept = async (file: File | null) => {
    if (!file || !book.sha256) return;
    setChecking(true);
    setMismatch(null);
    setFailure(null);
    try {
      const sha256 = await sha256Of(await file.arrayBuffer());
      if (sha256 !== book.sha256) {
        setMismatch(file.name);
        return;
      }
      await putFile(sha256, file);
      onRestored();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'Не удалось сохранить файл на устройстве');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Card withBorder padding="xl" radius="lg">
      <Stack align="center" gap="sm" py="lg">
        <ThemeIcon size={48} radius="xl" variant="light" color="gray">
          <IconDeviceMobile size={24} />
        </ThemeIcon>
        <Text fw={600}>Файл этой книги на другом устройстве</Text>
        <Text size="sm" c="dimmed" ta="center" maw={420}>
          На сервере хранится полка — название, обложка и место, на котором вы остановились. Сам файл лежит там, где
          книгу добавляли. Выберите его здесь, и книга откроется: прогресс и заметки останутся на месте.
        </Text>

        {/* Файл не обязан лежать на этой машине: системное окно выбора на всех живых системах
            показывает Яндекс.Диск, Google Drive и iCloud обычной папкой. Это и закрывает случай
            «сел за другой компьютер» — без единой интеграции с их стороны и с нашей. */}
        <Tooltip
          label="Файл можно взять и из облака: в окне выбора Яндекс.Диск, Google Drive и iCloud видны как обычные папки"
          withArrow
          multiline
          w={280}
        >
          <div>
            <FileButton onChange={accept} accept=".pdf,.docx,.fb2,.djvu,.djv">
              {(props) => (
                <Button {...props} leftSection={<IconUpload size={16} />} loading={checking} mt="xs">
                  Добавить файл
                </Button>
              )}
            </FileButton>
          </div>
        </Tooltip>

        <Text size="xs" c="dimmed" ta="center" maw={420}>
          Файл можно выбрать и из облачного диска — в окне выбора Яндекс.Диск, Google&nbsp;Drive и iCloud видны как
          обычные папки.
        </Text>

        {book.fileName && (
          <Text size="xs" c="dimmed">
            Исходное имя файла: {book.fileName}
          </Text>
        )}

        {mismatch && (
          <Alert color="yellow" variant="light" w="100%" title="Это другой файл">
            <Stack gap="xs">
              <Text size="sm">
                Содержимое «{mismatch}» не совпадает с этой книгой. Файл мог быть пересохранён или это другое издание —
                тогда прогресс и закладки к нему не относятся.
              </Text>
              <Group>
                {/* Добавить его отдельной книгой — обычный путь: библиотека, «Добавить книгу». */}
                <Button size="xs" variant="light" component={Link} to="/library">
                  Добавить его отдельной книгой
                </Button>
              </Group>
            </Stack>
          </Alert>
        )}

        {failure && (
          <Alert color="red" variant="light" w="100%" title="Не удалось сохранить">
            {failure}
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
