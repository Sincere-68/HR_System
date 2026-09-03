import type { ColumnsType } from 'antd/es/table';
import type { TableExportField } from '../../features/employees/TableExportDialog';

export function fieldsFromColumns<T>(columns: ColumnsType<T>): TableExportField[] {
  return columns.flatMap((column) => {
    if (!('dataIndex' in column) || typeof column.title !== 'string' || typeof column.dataIndex !== 'string') {
      return [];
    }
    return [{ key: column.dataIndex, title: column.title }];
  });
}

export function onboardingExportQuery(query: { page?: number; pageSize?: number }) {
  return {
    ...(query.page !== undefined ? { page: query.page } : {}),
    ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
  };
}
