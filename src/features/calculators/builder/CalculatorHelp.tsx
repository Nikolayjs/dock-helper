import { Alert, Code, Divider, List, Modal, Stack, Table, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';

import { FORMULA_CONSTANT_NAMES, FORMULA_FUNCTION_DOCS } from '../../../lib/formulaEngine';

/**
 * Справка по конструктору калькуляторов.
 *
 * **Список функций берётся из движка** (`FORMULA_FUNCTION_DOCS`) — из того же места, откуда их знает
 * вычислитель. Справка, живущая отдельно, рано или поздно начинает обещать функцию, которой нет,
 * или молчать о той, которая есть; совпадение и работоспособность каждого примера проверяются
 * тестом.
 *
 * Всё остальное написано руками, и написано про **ловушки**, а не про очевидное. Расставить поля и
 * нажать «Сохранить» видно и без справки; чего не видно — что десятичный разделитель только точка,
 * что верхняя граница полосы не включается, и что `-2^2` равно четырём.
 */
export function CalculatorHelp({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  return (
    <Modal opened={opened} onClose={onClose} title="Как собрать калькулятор" size="xl" radius="lg">
      <Stack gap="lg">
        <Text size="sm">
          Калькулятор — это набор полей, формула над ними и, если нужно, полосы толкования результата.
          Врач заполняет поля, приложение считает формулу и показывает число вместе с подписью полосы,
          в которую оно попало.
        </Text>

        <div>
          <Title order={5} mb={6}>
            Поля
          </Title>
          <Text size="sm" mb="xs">
            У каждого поля два имени. <b>Ключ</b> — то, чем поле зовётся в формуле: латиница, цифры и{' '}
            <Code>_</Code>, не начиная с цифры. <b>Подпись</b> — то, что видит врач, и она может быть
            любой. Разделены они не из вредности: формула, набранная русскими словами с пробелами, не
            разбирается однозначно, а подпись меняют часто — и формула от переименования не ломается.
          </Text>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={160}>Тип поля</Table.Th>
                <Table.Th>Что это и что попадает в формулу</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Число</Table.Td>
                <Table.Td>
                  Обычное числовое поле: вес, рост, креатинин. В формулу попадает само число.
                  Единицы измерения стоит написать в подписи — приложение их не переводит.
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Список</Table.Td>
                <Table.Td>
                  Выбор из вариантов, у каждого своё число. Так задаются пол и коэффициенты: вариант
                  «Женский» со значением <Code>0.85</Code> — и в формуле это <Code>0.85</Code>, а не
                  слово. Врач при этом видит подпись, а не множитель.
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </div>

        <Divider />

        <div>
          <Title order={5} mb={6}>
            Формула
          </Title>
          <Text size="sm" mb="xs">
            Пишется ключами полей: <Code>weight / (height * height)</Code>. Доступны операторы{' '}
            <Code>+ − * / % ^</Code>, сравнения <Code>{'< <= > >= = <>'}</Code>, скобки и константы{' '}
            {FORMULA_CONSTANT_NAMES.map((name) => (
              <Code key={name} mr={4}>
                {name}
              </Code>
            ))}
            .
          </Text>

          <Alert variant="light" color="orange" icon={<IconAlertTriangle size={16} />} mb="sm">
            <List size="sm" spacing={4}>
              <List.Item>
                <b>Десятичный разделитель — только точка.</b> <Code>0.85</Code>, не <Code>0,85</Code>:
                запятая занята разделителем аргументов, и <Code>min(1,5; 2)</Code> иначе не разобрать
                однозначно.
              </List.Item>
              <List.Item>
                <b>Аргументы разделяются точкой с запятой</b> — <Code>round(x; 1)</Code>. Запятая
                тоже принимается.
              </List.Item>
              <List.Item>
                <b>
                  <Code>−2^2</Code> равно 4, а не −4.
                </b>{' '}
                Унарный минус связывает крепче степени — как в Excel, вопреки математической записи.
              </List.Item>
              <List.Item>
                <b>
                  <Code>%</Code> — это остаток от деления, а не проценты.
                </b>{' '}
                «70%» отвергается с ошибкой, а не превращается тихо в единицу.
              </List.Item>
              <List.Item>
                <b>Два сравнения подряд запрещены.</b> <Code>1 &lt; x &lt; 5</Code> посчиталось бы как{' '}
                <Code>(1 &lt; x) &lt; 5</Code> — «ноль или единица меньше пяти», то есть всегда
                истина. Пишется через <Code>and(1 &lt; x; x &lt; 5)</Code>.
              </List.Item>
            </List>
          </Alert>

          <Text size="sm" mb="xs">
            Сравнение возвращает <Code>1</Code> или <Code>0</Code>, поэтому условие — это обычное
            число: <Code>if(sex = 2; 0.85 * clearance; clearance)</Code> читается как «если пол
            женский, умножить на 0,85».
          </Text>

          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={180}>Функция</Table.Th>
                <Table.Th>Что делает</Table.Th>
                <Table.Th w={260}>Пример</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {FORMULA_FUNCTION_DOCS.map((doc) => (
                <Table.Tr key={doc.name}>
                  <Table.Td>
                    <Code>{doc.signature}</Code>
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
            В подписи <Code>[x]</Code> — необязательный аргумент, <Code>…</Code> — сколько угодно.
            Лишний аргумент — это ошибка, а не молча отброшенное: <Code>round(x; 1)</Code> обязан
            давать десятые.
          </Text>
        </div>

        <Divider />

        <div>
          <Title order={5} mb={6}>
            Полосы толкования
          </Title>
          <Text size="sm" mb="xs">
            Необязательны. Полоса — это диапазон результата с подписью и цветом: «Норма», «Ожирение».
            Показывается та, в которую попал <b>округлённый</b> результат, — тот самый, что видит
            врач: иначе плашка противоречила бы числу над ней.
          </Text>
          <Alert variant="light" color="orange" icon={<IconAlertTriangle size={16} />} mb="sm">
            <b>Нижняя граница включается, верхняя — нет.</b> Поэтому соседние полосы пишутся{' '}
            <b>одним и тем же числом</b>: <Code>до 25</Code> и <Code>от 25</Code>. Полосы из учебника —{' '}
            <Code>18,5–24,9</Code> и <Code>25–29,9</Code> — оставляют 24,95 без толкования вовсе, и
            плашка просто не появится.
          </Alert>
          <Table withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={90}>от (≥)</Table.Th>
                <Table.Th w={90}>до (&lt;)</Table.Th>
                <Table.Th>Название</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td c="dimmed">без границы</Table.Td>
                <Table.Td>18.5</Table.Td>
                <Table.Td>Дефицит массы тела</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>18.5</Table.Td>
                <Table.Td>25</Table.Td>
                <Table.Td>Норма</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>25</Table.Td>
                <Table.Td>30</Table.Td>
                <Table.Td>Избыточная масса тела</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>30</Table.Td>
                <Table.Td c="dimmed">без границы</Table.Td>
                <Table.Td>Ожирение</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Text size="sm" mt="xs">
            Пустая граница — это «полоса открыта», а не ноль: так пишутся первая и последняя. Если
            полосы разойдутся или наложатся, конструктор скажет об этом сам — но не запретит:
            промежуток без толкования бывает и намеренным.
          </Text>
          <Text size="sm" mt="xs">
            <b>Пояснение</b> у полосы — то, ради чего толкование и нужно. Число врач и так видит;
            ценность в том, чтобы сказать, меняет ли оно что-нибудь: что обычно делают на этой полосе
            и чего не стоит пропустить.
          </Text>
        </div>

        <Divider />

        <div>
          <Title order={5} mb={6}>
            Пресеты
          </Title>
          <Text size="sm">
            Готовые наборы значений, которые подставляются в поля одним нажатием: типовой пациент,
            частая схема. Нужны там, где половина полей от расчёта к расчёту не меняется.
          </Text>
        </div>

        <Divider />

        <div>
          <Title order={5} mb={6}>
            Пример целиком: индекс массы тела
          </Title>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td w={160}>Поля</Table.Td>
                <Table.Td>
                  <Code>weight</Code> «Вес, кг» · <Code>height</Code> «Рост, м»
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Формула</Table.Td>
                <Table.Td>
                  <Code>weight / (height * height)</Code>
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Результат</Table.Td>
                <Table.Td>
                  «ИМТ», единицы <Code>кг/м²</Code>, знаков после запятой — 1
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Полосы</Table.Td>
                <Table.Td>как в таблице выше</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
          <Text size="sm" mt="xs">
            Проверить, не сохраняя, можно во вкладке «Предпросмотр»: она считает по тому же движку,
            что и готовый калькулятор.
          </Text>
        </div>
      </Stack>
    </Modal>
  );
}
