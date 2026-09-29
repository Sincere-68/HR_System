import type { EmploymentStatus } from '@hr-demo/shared';
import { Tag } from 'antd';

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  PROBATION: '试用',
  REGULAR: '正式',
  PENDING_ENTRY: '待入职',
  TRANSFERRED_OUT: '调出',
  PENDING_TRANSFER_IN: '待调入',
  RETIRED: '退休',
  RESIGNED: '离职',
  NON_REGULAR: '非正式',
};

const statusColors: Record<EmploymentStatus, string> = {
  PROBATION: 'processing',
  REGULAR: 'success',
  PENDING_ENTRY: 'processing',
  TRANSFERRED_OUT: 'default',
  PENDING_TRANSFER_IN: 'processing',
  RETIRED: 'default',
  RESIGNED: 'default',
  NON_REGULAR: 'warning',
};

export function EmploymentStatusTag({ status }: { status: EmploymentStatus }) {
  return <Tag color={statusColors[status]}>{employmentStatusLabels[status]}</Tag>;
}
