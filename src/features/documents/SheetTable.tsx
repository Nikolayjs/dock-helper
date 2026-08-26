import { Table, Text } from '@mantine/core';

import type { DocumentSheet } from './types';

/**
 * Таблица документа для чтения.
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
          {sheet.rows.map((row, rowIndex) => (
            <Table.Tr key={rowIndex}>
              {row.map((cell, columnIndex) => (
                <Table.Td key={columnIndex} style={{ whiteSpace: 'pre-wrap' }}>
                  {cell}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
