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

const implementedRoutes = new Set([
  '/personnel/employees',
  '/personnel/blacklist',
  '/personnel/approval',
  '/contracts',
  '/onboarding/offers',
  '/onboarding/entries',
  '/onboarding/integration',
  '/onboarding/introduction',
  '/onboarding/id-card-reader',
  '/employment/probation',
  '/employment/changes',
  '/employment/trial-post',
  '/employment/interns',
  '/employment/labor',
  '/employment/part-time',
  '/employment/records',
  '/employment/termination',
  '/employment/retirement',
  '/handover',
  '/subsets/education',
  '/subsets/work-history',
  '/subsets/family',
  '/subsets/appraisals',
  '/subsets/training',
  '/subsets/awards',
  '/subsets/certificates',
  '/subsets/projects',
  '/subsets/skills',
  '/subsets/languages',
  '/staffing/transfer-types',
  '/analytics/roster',
]);

export const placeholderRoutes = navigationItems.flatMap((item) =>
  item.children
    ? item.children.filter((child) => !implementedRoutes.has(child.key))
    : item.key.startsWith('/') && !implementedRoutes.has(item.key)
      ? [item]
      : [],
);

export const placeholderHeadingTabs: Record<string, string[]> = {
  '/employment/trial-post': ['试岗中人员', '考核中', '试岗不通过', '试岗通过', '全部试岗记录'],
  '/employment/interns': ['实习生', '实习转正中', '已转正', '已离职'],
  '/employment/termination': ['离职中的员工', '已完成的离职', '全部离职记录'],
  '/employment/reporting-lines': ['汇报关系', '汇报关系图'],
  '/subsets/materials': ['按人员查看', '按分类查看', '全部材料'],
  '/analytics/dashboard': ['人事看板管理', '人员结构分析', '人员流动分析', '人事流程看板'],
  '/analytics/structure': ['员工素质结构', '员工任职结构'],
  '/analytics/mobility': ['员工流动统计', '各月入离职统计', '各机构入离职统计', '员工流入统计', '员工流出统计', '组织编制统计'],
};

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
