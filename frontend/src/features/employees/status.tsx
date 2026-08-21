import type { EmploymentStatus } from '@hr-demo/shared';
import { Tag } from 'antd';

export const employmentStatusLabels: Record<EmploymentStatus, string> = {
  ACTIVE: '在职',
  INACTIVE: '非在职',
};

export function EmploymentStatusTag({ status }: { status: EmploymentStatus }) {
  return status === 'ACTIVE' ? (
    <Tag color="success">{employmentStatusLabels[status]}</Tag>
  ) : (
    <Tag>{employmentStatusLabels[status]}</Tag>
  );
}
