import type { ReactNode } from 'react';
import {
  CheckSquareOutlined,
  FileTextOutlined,
  FundOutlined,
  TeamOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';

export interface PerformanceNavigationItem {
  key: string;
  label: string;
  icon: ReactNode;
}

export const performanceNavigationItems: PerformanceNavigationItem[] = [
  { key: '/performance', label: '绩效总览', icon: <FundOutlined /> },
  { key: '/performance/activities', label: '员工绩效活动', icon: <TeamOutlined /> },
  { key: '/performance/templates', label: '绩效模板', icon: <FileTextOutlined /> },
  { key: '/performance/tasks', label: '绩效任务', icon: <UnorderedListOutlined /> },
  { key: '/performance/my-tasks', label: '我的待办', icon: <CheckSquareOutlined /> },
];

export function getPerformanceNavigationKey(pathname: string) {
  return performanceNavigationItems
    .filter((item) => item.key !== '/performance' && (pathname === item.key || pathname.startsWith(`${item.key}/`)))
    .sort((left, right) => right.key.length - left.key.length)[0]?.key
    ?? (pathname === '/performance' ? '/performance' : undefined);
}

export function findPerformanceNavigationLabel(pathname: string) {
  const key = getPerformanceNavigationKey(pathname);
  return performanceNavigationItems.find((item) => item.key === key)?.label ?? '绩效系统';
}
