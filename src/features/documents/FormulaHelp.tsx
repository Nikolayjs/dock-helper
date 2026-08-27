import { Code, Divider, Modal, Stack, Table, Text, Title } from '@mantine/core';

import { ERRORS, FUNCTION_DOCS } from '../../lib/sheet/formula';

/**
 * Справка по формулам.
 *
 * Список функций берётся из `FUNCTION_DOCS` — того же места, из которого их знает вычислитель.
 * Справка, живущая отдельно, рано или поздно начинает обещать функцию, которой нет, или молчать о
 * той, которая есть; совпадение проверяется тестом.
 */
const ERROR_DOCS: { code: string; meaning: string }[] = [
  { code: ERRORS.div0, meaning: 'Деление на ноль или на пустую ячейку' },
  { code: ERRORS.value, meaning: 'В расчёте участвует текст или формула написана с ошибкой' },
  { code: ERRORS.name, meaning: 'Незнакомое имя функции' },
  { code: ERRORS.ref, meaning: 'Ссылка указывает за пределы таблицы' },
  { code: ERRORS.cycle, meaning: 'Ячейка считает сама себя — по кругу' },
];

export function FormulaHelp({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Формулы" size="lg" radius="lg">
      <Stack gap="lg">
        <div>
          <Text size="sm">
            Формула начинается со знака <Code>=</Code>. Пока ячейка в фокусе, видна сама формула; стоит уйти — на её месте
            результат.
          </Text>
        </div>

        <div>
          <Title order={5} mb={6}>
            Адреса ячеек
          </Title>
          <Text size="sm">
            Столбцы обозначены буквами в шапке, строки — номерами слева. Заголовки — это строка{' '}
            <Code>1</Code>, первая строка данных — <Code>2</Code>: та же нумерация, что в Excel, чтобы формула
            означала здесь ровно то же, что в выгруженном файле.
          </Text>
          <Table mt="xs" withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td w={140}>
                  <Code>B2</Code>
                </Table.Td>
                <Table.Td>Одна ячейка: столбец B, строка 2</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>
                  <Code>B2:B20</Code>
                </Table.Td>
                <Table.Td>Диапазон — весь кусок столбца со 2-й по 20-ю строку</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>
                  <Code>$B$1</Code>
                </Table.Td>
                <Table.Td>
                  Закреплённый адрес: не съезжает при сортировке. Так удобно ссылаться на ставку или коэффициент,
                  записанный в одну ячейку
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </div>

        <div>
          <Title order={5} mb={6}>
            Действия
          </Title>
          <Text size="sm">
            <Code>+</Code> <Code>-</Code> <Code>*</Code> <Code>/</Code> <Code>^</Code> — сложение, вычитание, умножение,
            деление, степень. Скобки задают порядок. <Code>&amp;</Code> склеивает текст: <Code>=A2&amp;&quot; — &quot;&amp;B2</Code>.
          </Text>
          <Text size="sm" mt={6}>
            Сравнения <Code>=</Code> <Code>&lt;&gt;</Code> <Code>&lt;</Code> <Code>&gt;</Code> <Code>&lt;=</Code>{' '}
            <Code>&gt;=</Code> нужны внутри <Code>ЕСЛИ</Code>.
          </Text>
        </div>

        <div>
          <Title order={5} mb={6}>
            Функции
          </Title>
          <Table withTableBorder withColumnBorders striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={110}>Имя</Table.Th>
                <Table.Th>Что делает</Table.Th>
                <Table.Th w={210}>Пример</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {FUNCTION_DOCS.map((doc) => (
                <Table.Tr key={doc.name}>
                  <Table.Td>
                    <Code>{doc.name}</Code>
                  </Table.Td>
                  <Table.Td>{doc.summary}</Table.Td>
                  <Table.Td>
                    <Code>{doc.example}</Code>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed" mt={6}>
            Английские имена работают наравне с русскими: формулу, скопированную из чужого файла, переписывать не нужно.
          </Text>
        </div>

        <div>
          <Title order={5} mb={6}>
            Две вещи, о которых спрашивают чаще всего
          </Title>
          <Text size="sm">
            <b>Дробная часть отделяется точкой:</b> <Code>=B2*1.2</Code>. Запятая занята под разделитель аргументов, и
            иначе <Code>СУММ(1,5;2)</Code> было бы не разобрать однозначно.
          </Text>
          <Text size="sm" mt={6}>
            <b>Аргументы разделяются точкой с запятой</b> — как в русском Excel. Запятая тоже принимается.
          </Text>
        </div>

        <Divider />

        <div>
          <Title order={5} mb={6}>
            Если вместо числа появилось сообщение
          </Title>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              {ERROR_DOCS.map((error) => (
                <Table.Tr key={error.code}>
                  <Table.Td w={110}>
                    <Code c="red">{error.code}</Code>
                  </Table.Td>
                  <Table.Td>{error.meaning}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </div>

        <Text size="xs" c="dimmed">
          В скачанном <Code>.xlsx</Code> лежат настоящие формулы: Excel пересчитает их при первой же правке. Имена в
          файле английские — так устроен формат, и русский Excel покажет их по-русски сам.
        </Text>
      </Stack>
    </Modal>
  );
}
