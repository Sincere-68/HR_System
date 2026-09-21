export const ACCESS_CONTROL_PERMISSION_DEFINITIONS = [
  { code: 'employee.read', name: '查看员工' },
  { code: 'employee.create', name: '新增员工' },
  { code: 'employee.update', name: '编辑员工' },
  { code: 'employee.data.all', name: '查看全部部门员工' },
  { code: 'organization.read', name: '查看组织' },
  { code: 'performance.read', name: '查看绩效' },
  { code: 'performance.template.manage', name: '管理绩效模板' },
  { code: 'performance.cycle.manage', name: '管理绩效周期' },
  { code: 'performance.task.handle', name: '处理绩效任务' },
  { code: 'performance.result.modify', name: '修改绩效结果' },
  { code: 'performance.amount-base.manage', name: '管理绩效金额基数' },
] as const;

const HR_PERMISSION_CODES = ACCESS_CONTROL_PERMISSION_DEFINITIONS.map(({ code }) => code);

/**
 * Keep the legacy role codes stable for existing users while applying the
 * clarified account policy through display names and permissions.
 */
export const ACCESS_CONTROL_ROLE_DEFINITIONS = [
  {
    code: 'ADMIN',
    name: '管理员',
    permissionCodes: HR_PERMISSION_CODES,
  },
  {
    code: 'DEPT_ADMIN',
    name: 'HR管理员',
    permissionCodes: HR_PERMISSION_CODES,
  },
  {
    code: 'VIEWER',
    name: '普通员工',
    permissionCodes: ['employee.read'],
  },
] as const;
