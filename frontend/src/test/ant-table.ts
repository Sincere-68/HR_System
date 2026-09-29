import { screen } from '@testing-library/react';

/**
 * Sticky Ant Design tables split headers and rows into separate tables.
 * Return their shared container so assertions can cover the full grid.
 */
export function getAntTable() {
  const tables = screen.getAllByRole('table') as HTMLTableElement[];
  const bodyTable = tables.find((table) => table.querySelector('.ant-table-tbody'));
  return bodyTable?.closest<HTMLElement>('.ant-table-container') ?? tables[0]!;
}
