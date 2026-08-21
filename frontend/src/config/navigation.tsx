import type { ReactNode } from 'react';
import {
  BarChartOutlined,
  FileDoneOutlined,
  FolderOpenOutlined,
  IdcardOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserSwitchOutlined,
} from '@ant-design/icons';

export interface NavigationItem {
  key: string;
  label: string;
  icon?: ReactNode;
  children?: NavigationItem[];
}

export const navigationItems: NavigationItem[] = [
  {
    key: 'personnel',
    label: '人员信息',
    icon: <TeamOutlined />,
    children: [
      { key: '/personnel/employees', label: '人员' },
      { key: '/personnel/blacklist', label: '黑名单管理' },
      { key: '/personnel/approval', label: '员工信息审批' },
    ],
  },
  {
    key: 'onboarding',
    label: '录用入职',
    icon: <SolutionOutlined />,
    children: [
      { key: '/onboarding/offers', label: 'Offer管理' },
      { key: '/onboarding/entries', label: '入职管理' },
      { key: '/onboarding/integration', label: '新员工融入' },
      { key: '/onboarding/introduction', label: '新员工入职介绍' },
      { key: '/onboarding/id-card-reader', label: '读取身份证' },
    ],
  },
  {
    key: 'employment',
    label: '任职管理',
    icon: <UserSwitchOutlined />,
    children: [
      { key: '/employment/probation', label: '试用管理' },
      { key: '/employment/changes', label: '异动管理' },
      { key: '/employment/trial-post', label: '试岗期管理' },
      { key: '/employment/interns', label: '实习生管理' },
      { key: '/employment/labor', label: '劳务人员管理' },
      { key: '/employment/termination', label: '离职管理' },
      { key: '/employment/retirement', label: '退休管理' },
      { key: '/employment/part-time', label: '兼职管理' },
      { key: '/employment/records', label: '任职记录' },
      { key: '/employment/reporting-lines', label: '汇报关系' },
    ],
  },
  { key: '/contracts', label: '合同协议', icon: <FileDoneOutlined /> },
  {
    key: 'subsets',
    label: '人员子集',
    icon: <FolderOpenOutlined />,
    children: [
      { key: '/subsets/education', label: '教育经历' },
      { key: '/subsets/work-history', label: '工作履历' },
      { key: '/subsets/family', label: '家庭成员' },
      { key: '/subsets/appraisals', label: '考核结果' },
      { key: '/subsets/training', label: '培训经历' },
      { key: '/subsets/awards', label: '表彰与奖励' },
      { key: '/subsets/certificates', label: '证书执照' },
      { key: '/subsets/projects', label: '项目经历' },
      { key: '/subsets/skills', label: '专业技能' },
      { key: '/subsets/languages', label: '语言能力' },
      { key: '/subsets/materials', label: '材料管理' },
    ],
  },
  {
    key: 'staffing',
    label: '编制管理',
    icon: <IdcardOutlined />,
    children: [{ key: '/staffing/transfer-types', label: '调动类型' }],
  },
  { key: '/handover', label: '职责转交', icon: <IdcardOutlined /> },
  {
    key: 'analytics',
    label: '数据分析',
    icon: <BarChartOutlined />,
    children: [
      { key: '/analytics/dashboard', label: '人事看板' },
      { key: '/analytics/roster', label: '员工名册' },
      { key: '/analytics/structure', label: '员工结构' },
      { key: '/analytics/mobility', label: '流动情况' },
      { key: '/analytics/contracts', label: '合同情况' },
      { key: '/analytics/reports', label: '报表设计' },
    ],
  },
  { key: '/settings', label: '设置', icon: <SettingOutlined /> },
];

export const placeholderRoutes = navigationItems.flatMap((item) =>
  item.children
    ? item.children.filter((child) => child.key !== '/personnel/employees')
    : item.key.startsWith('/') && item.key !== '/personnel/employees'
      ? [item]
      : [],
);

export function findNavigationLabel(pathname: string) {
  for (const item of navigationItems) {
    if (item.key === pathname) return item.label;
    const child = item.children?.find((candidate) => candidate.key === pathname);
    if (child) return child.label;
  }
  return '人员管理系统';
}

export function findOpenMenuKeys(pathname: string) {
  const parent = navigationItems.find((item) =>
    item.children?.some((child) => pathname === child.key || pathname.startsWith(`${child.key}/`)),
  );
  return parent ? [parent.key] : [];
}
