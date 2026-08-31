import { EMPLOYMENT_STATUSES, type EmploymentStatus } from '@hr-demo/shared';
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

export const employmentStatusOptions = EMPLOYMENT_STATUSES.map((value) => ({
  value,
  label: employmentStatusLabels[value],
}));

export function EmploymentStatusTag({ status }: { status: EmploymentStatus }) {
  const color = status === 'REGULAR'
    ? 'success'
    : status === 'PROBATION' || status === 'PENDING_ENTRY' || status === 'PENDING_TRANSFER_IN'
      ? 'processing'
      : status === 'RESIGNED' || status === 'RETIRED' || status === 'TRANSFERRED_OUT'
        ? 'default'
        : 'warning';
  return <Tag color={color}>{employmentStatusLabels[status]}</Tag>;
}
