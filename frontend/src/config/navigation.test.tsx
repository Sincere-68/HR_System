import { describe, expect, it } from 'vitest';
import { buildNavigationItems, findNavigationLabel, toMenuItems } from './navigation';

const employmentLabels = [
  '试用管理',
  '异动管理',
  '试岗期管理',
  '实习生管理',
  '劳务人员管理',
  '离职管理',
  '退休管理',
  '兼职管理',
  '任职记录',
  '汇报关系',
];

describe('permission-aware navigation', () => {
  it('keeps exactly the ten Beisen employment entries in their existing order', () => {
    const employment = buildNavigationItems([]).find(({ key }) => key === 'employment');

    expect(employment?.children?.map(({ label }) => label)).toEqual(employmentLabels);
    expect(employment?.children).toHaveLength(10);
    expect(employment?.children?.some(({ key }) => key === '/employment/approvals')).toBe(false);
  });

  it('shows employment flow settings only with its explicit permission', () => {
    const withoutPermission = buildNavigationItems(['employee.read']);
    const withPermission = buildNavigationItems(['employee.read', 'employment.approval-flow.manage']);

    expect(withoutPermission.some(({ key }) => key === '/settings/employment-approval-flows')).toBe(false);
    expect(withPermission).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: '/settings/employment-approval-flows', label: '任职审批流程' }),
    ]));
  });

  it('labels auxiliary routes without adding them to the sidebar', () => {
    expect(findNavigationLabel('/employment/approvals')).toBe('任职审批');
    expect(findNavigationLabel('/settings/employment-approval-flows')).toBe('任职审批流程');
  });

  it('does not pass permission metadata to Ant Design menu items', () => {
    const settings = toMenuItems(buildNavigationItems(['employment.approval-flow.manage']).filter(({ key }) => key === '/settings/employment-approval-flows'))?.[0];
    expect(settings).not.toHaveProperty('requiredPermission');
  });
});
