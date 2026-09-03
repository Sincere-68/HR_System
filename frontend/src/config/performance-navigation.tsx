import type { ReactNode } from 'react';
import {
  AuditOutlined,
  CheckSquareOutlined,
  FileTextOutlined,
  FundOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

export interface PerformanceNavigationItem {
  key: string;
  label: string;
  icon: ReactNode;
}

export const performanceNavigationItems: PerformanceNavigationItem[] = [
  { key: '/performance', label: '绩效总览', icon: <FundOutlined /> },
  { key: '/performance/templates', label: '绩效模板', icon: <FileTextOutlined /> },
  { key: '/performance/tasks', label: '绩效任务', icon: <UnorderedListOutlined /> },
  { key: '/performance/my-tasks', label: '我的待办', icon: <CheckSquareOutlined /> },
  { key: '/performance/results', label: '结果审批', icon: <AuditOutlined /> },
  { key: '/performance/settings/amount-base', label: '金额基数', icon: <SettingOutlined /> },
];

export function findPerformanceNavigationLabel(pathname: string) {
  return performanceNavigationItems.find((item) => item.key === pathname)?.label ?? '绩效系统';
}
