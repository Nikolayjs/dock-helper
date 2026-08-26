import { Table, Text } from '@mantine/core';

import { evaluateGrid } from '../../lib/sheet/formula';
import { buildGrid } from './sheetOps';
import type { DocumentSheet } from './types';

/**
 * Таблица документа для чтения.
 *
 * Показывает результаты формул, а не их текст: на бумаге и в выгруженном файле стоят числа, и
 * просмотр обязан показывать ровно то же. Строка итогов отделена и набрана полужирным — так же, как
 * она выглядит в .xlsx.
 *
 * Прокрутка своя, а не страницы: реестр в двенадцать столбцов иначе растянул бы всю страницу по
 * горизонтали, и вместе с ней — шапку и кнопки.
 */
export function SheetTable({ sheet }: { sheet: DocumentSheet | null }) {
  if (!sheet || sheet.columns.length === 0) {
    return (
      <Text size="sm" c="dimmed">
        Таблица пуста.
      </Text>
    );
  }

  const computed = evaluateGrid(buildGrid(sheet));
  const rows = computed.slice(1, sheet.rows.length + 1);
  const totals = sheet.totals ? computed[sheet.rows.length + 1] : null;

  return (
    <Table.ScrollContainer minWidth={400}>
      <Table withTableBorder withColumnBorders striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {sheet.columns.map((column, index) => (
              <Table.Th key={index}>{column}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((row, rowIndex) => (
            <Table.Tr key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <Table.Td key={columnIndex} style={{ whiteSpace: 'pre-wrap' }}>
                  {cell}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
        {totals && (
          <Table.Tfoot>
            <Table.Tr>
              {totals.map((cell, columnIndex) => (
                // Полоса потолще — иначе итог сливается с последней строкой данных и читается как
                // ещё один пациент.
                <Table.Th
                  key={columnIndex}
                  style={{ whiteSpace: 'pre-wrap', borderTop: '2px solid var(--mantine-color-default-border)' }}
                >
                  {cell}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Tfoot>
        )}
      </Table>
    </Table.ScrollContainer>
  );
}
