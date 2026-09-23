import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EmploymentStatus, ProcessStatus } from '@prisma/client';
import {
  PERMISSIONS,
  ORGANIZATION_CATALOG,
  type AuthUser,
  type Organization,
  type UpdateEmployeeInput,
} from '@hr-demo/shared';
import type { AuditContext } from '../audit/audit.service';

export interface DemoEmployeeRecord {
  id: string;
  employeeNo: string;
  name: string;
  mobile: string;
  /** Demo compatibility value for its fictional national-ID-only records. */
  idCardNo: string | null;
  organizationId: string;
  organization: { name: string };
  employmentRecords: { status: EmploymentStatus }[];
  createdAt: Date;
  updatedAt: Date;
}

export type DemoProbationEvaluationType = 'IN_PROBATION' | 'REGULARIZATION';

export interface DemoProbationApproval {
  status: ProcessStatus;
  approverUserId: string;
  submittedAt: Date;
  lastRemindedAt?: Date;
}

export interface DemoProbationRecord {
  id: string;
  employeeId: string;
  organizationId: string;
  positionName: string | null;
  jobTitleName: string | null;
  startDate: Date;
  plannedEndDate: Date;
  probationMonths: number | null;
  actualEndDate: Date | null;
  evaluationType: DemoProbationEvaluationType | null;
  evaluation: string | null;
  result: string | null;
  confirmedDate: Date | null;
  extensionCount: number;
  status: ProcessStatus;
  approval: DemoProbationApproval | null;
  createdAt: Date;
  updatedAt: Date;
}

interface DemoAccount extends AuthUser {
  password: string;
}

interface DemoAuditRecord {
  context: AuditContext;
  action: AuditAction;
  resourceId?: string;
  metadata?: unknown;
  createdAt: Date;
}

const organizations: Organization[] = ORGANIZATION_CATALOG.map(({ code, name, parentCode }) => ({
  id: `demo-org-${code.toLocaleLowerCase()}`,
  code,
  name,
  parentId: parentCode ? `demo-org-${parentCode.toLocaleLowerCase()}` : null,
}));

const organizationId = (code: string) => `demo-org-${code.toLocaleLowerCase()}`;

const accounts: DemoAccount[] = [
  {
    id: 'demo-user-admin',
    username: 'admin',
    password: 'Demo@123',
    displayName: '系统管理员',
    role: 'ADMIN',
    roleName: '管理员',
    permissions: Object.values(PERMISSIONS),
    organizationIds: [],
  },
  {
    id: 'demo-user-deptadmin',
    username: 'deptadmin',
    password: 'Demo@123',
    displayName: '部门管理员',
    role: 'DEPT_ADMIN',
    roleName: '部门管理员',
    permissions: [
      PERMISSIONS.EMPLOYEE_READ,
      PERMISSIONS.EMPLOYEE_CREATE,
      PERMISSIONS.EMPLOYEE_UPDATE,
      PERMISSIONS.ORGANIZATION_READ,
      PERMISSIONS.PERFORMANCE_READ,
      PERMISSIONS.PERFORMANCE_TEMPLATE_MANAGE,
      PERMISSIONS.PERFORMANCE_CYCLE_MANAGE,
      PERMISSIONS.PERFORMANCE_TASK_HANDLE,
      PERMISSIONS.PERFORMANCE_RESULT_MODIFY,
      PERMISSIONS.PERFORMANCE_AMOUNT_BASE_MANAGE,
    ],
    organizationIds: [organizationId('CEO_CHEN_RUI')],
  },
  {
    id: 'demo-user-viewer',
    username: 'viewer',
    password: 'Demo@123',
    displayName: '普通查看者',
    role: 'VIEWER',
    roleName: '普通查看者',
    permissions: [],
    organizationIds: [organizationId('CHAIRMAN_CHEN_GANG')],
  },
];

const initialEmployees = [
  {
    id: 'demo-employee-1001',
    employeeNo: 'DEMO-1001',
    name: '林知夏',
    mobile: '13800001001',
    idCardNo: '110101199203181021',
    organizationId: organizationId('CEO_SECOND_TMALL_SUPERMARKET'),
    status: EmploymentStatus.PROBATION,
  },
  {
    id: 'demo-employee-1002',
    employeeNo: 'DEMO-1002',
    name: '周予安',
    mobile: '13800001002',
    idCardNo: '310101199507092036',
    organizationId: organizationId('CEO_SECOND_TMALL_SUPERMARKET'),
    status: EmploymentStatus.PROBATION,
  },
  {
    id: 'demo-employee-2001',
    employeeNo: 'DEMO-2001',
    name: '陈嘉禾',
    mobile: '13800002001',
    idCardNo: '440101198911262412',
    organizationId: organizationId('CEO_STORAGE'),
    status: EmploymentStatus.RESIGNED,
  },
  {
    id: 'demo-employee-3001',
    employeeNo: 'DEMO-3001',
    name: '许星澜',
    mobile: '13800003001',
    idCardNo: '510101199604112527',
    organizationId: organizationId('CHAIRMAN_CUSTOMER_SERVICE'),
    status: EmploymentStatus.PROBATION,
  },
  {
    id: 'demo-employee-1003',
    employeeNo: 'DEMO-1003',
    name: '沈星河',
    mobile: '13800001003',
    idCardNo: '110101199809122318',
    organizationId: organizationId('CEO_SECOND_TMALL_SUPERMARKET'),
    status: EmploymentStatus.REGULAR,
  },
] as const;

function calendarDate(offsetDays = 0) {
  const now = new Date();
  return new Date(Date.UTC(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + offsetDays,
  ));
}

function toAuthUser(account: DemoAccount): AuthUser {
  const { password: _password, ...user } = account;
  return {
    ...user,
    permissions: [...user.permissions],
    organizationIds: [...user.organizationIds],
  };
}

@Injectable()
export class DemoDataService {
  readonly enabled: boolean;
  private employees: DemoEmployeeRecord[];
  private probationRecords: DemoProbationRecord[];
  private audits: DemoAuditRecord[] = [];
  private nextEmployeeNumber = 4001;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('DEMO_MODE', true);
    this.employees = this.createInitialEmployees();
    this.probationRecords = this.createInitialProbationRecords();
  }

  authenticate(username: string, password: string) {
    const account = accounts.find(
      (candidate) => candidate.username === username && candidate.password === password,
    );
    return account ? toAuthUser(account) : null;
  }

  getUser(userId: string) {
    const account = accounts.find((candidate) => candidate.id === userId);
    return account ? toAuthUser(account) : null;
  }

  getOrganizations() {
    return organizations.map((organization) => ({ ...organization }));
  }

  getOrganizationId(code: string) {
    return organizationId(code);
  }

  organizationExists(organizationId: string) {
    return organizations.some((organization) => organization.id === organizationId);
  }

  getEmployees() {
    return [...this.employees];
  }

  getEmployee(id: string) {
    return this.employees.find((employee) => employee.id === id);
  }

  setEmployeeEmploymentStatus(employeeId: string, status: EmploymentStatus) {
    const employee = this.getEmployee(employeeId);
    if (!employee) throw new ConflictException('员工不存在');
    employee.employmentRecords = [{ status }];
    employee.updatedAt = new Date();
    return employee;
  }

  getProbationRecords() {
    return this.probationRecords;
  }

  getProbationRecord(id: string) {
    return this.probationRecords.find((record) => record.id === id);
  }

  getProbationApprovers() {
    return accounts
      .filter((account) => account.permissions.includes(PERMISSIONS.EMPLOYEE_UPDATE))
      .map((account) => ({
        id: account.id,
        displayName: account.displayName,
        workEmail: null,
      }));
  }

  getProbationApprover(userId: string) {
    return this.getProbationApprovers().find((approver) => approver.id === userId);
  }

  createEmployee(input: {
    employeeNo: string;
    name: string;
    mobile: string;
    idCardNo: string;
    organizationId: string;
    employmentStatus: EmploymentStatus;
  }) {
    this.assertUnique(input.employeeNo, input.idCardNo);
    const now = new Date();
    const employee: DemoEmployeeRecord = {
      id: `demo-employee-${this.nextEmployeeNumber++}`,
      employeeNo: input.employeeNo,
      name: input.name,
      mobile: input.mobile,
      idCardNo: input.idCardNo.toUpperCase(),
      organizationId: input.organizationId,
      organization: { name: this.getOrganizationName(input.organizationId) },
      employmentRecords: [{ status: input.employmentStatus }],
      createdAt: now,
      updatedAt: now,
    };
    this.employees.push(employee);
    return employee;
  }

  updateEmployee(employee: DemoEmployeeRecord, input: UpdateEmployeeInput) {
    if (input.name !== undefined) employee.name = input.name;
    if (input.mobile !== undefined) employee.mobile = input.mobile;
    if (input.organizationId !== undefined) {
      employee.organizationId = input.organizationId;
      employee.organization = { name: this.getOrganizationName(input.organizationId) };
    }
    if (input.employmentStatus !== undefined) {
      employee.employmentRecords = [{ status: input.employmentStatus }];
    }
    employee.updatedAt = new Date();
    return employee;
  }

  recordAudit(
    context: AuditContext,
    action: AuditAction,
    resourceId: string | undefined,
    metadata?: unknown,
  ) {
    this.audits.push({ context: { ...context }, action, resourceId, metadata, createdAt: new Date() });
  }

  getAuditCount() {
    return this.audits.length;
  }

  private createInitialEmployees(): DemoEmployeeRecord[] {
    const createdAt = new Date('2026-01-01T00:00:00.000Z');
    return initialEmployees.map((employee) => ({
      id: employee.id,
      employeeNo: employee.employeeNo,
      name: employee.name,
      mobile: employee.mobile,
      idCardNo: employee.idCardNo,
      organizationId: employee.organizationId,
      organization: { name: this.getOrganizationName(employee.organizationId) },
      employmentRecords: [{ status: employee.status }],
      createdAt: new Date(createdAt),
      updatedAt: new Date(createdAt),
    }));
  }

  private createInitialProbationRecords(): DemoProbationRecord[] {
    const createdAt = calendarDate(-90);
    return [
      {
        id: 'demo-probation-1001',
        employeeId: 'demo-employee-1001',
        organizationId: organizationId('CEO_SECOND_TMALL_SUPERMARKET'),
        positionName: '运营专员',
        jobTitleName: '运营专员',
        startDate: calendarDate(-80),
        plannedEndDate: calendarDate(10),
        probationMonths: 3,
        actualEndDate: null,
        evaluationType: null,
        evaluation: null,
        result: null,
        confirmedDate: null,
        extensionCount: 0,
        status: ProcessStatus.DRAFT,
        approval: null,
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
      },
      {
        id: 'demo-probation-1002',
        employeeId: 'demo-employee-1002',
        organizationId: organizationId('CEO_SECOND_TMALL_SUPERMARKET'),
        positionName: '运营主管',
        jobTitleName: '运营主管',
        startDate: calendarDate(-70),
        plannedEndDate: calendarDate(20),
        probationMonths: 3,
        actualEndDate: null,
        evaluationType: 'REGULARIZATION',
        evaluation: '待完成直属经理评价',
        result: null,
        confirmedDate: null,
        extensionCount: 0,
        status: ProcessStatus.IN_PROGRESS,
        approval: null,
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
      },
      {
        id: 'demo-probation-3001',
        employeeId: 'demo-employee-3001',
        organizationId: organizationId('CHAIRMAN_CUSTOMER_SERVICE'),
        positionName: '售后客服',
        jobTitleName: '客服专员',
        startDate: calendarDate(-85),
        plannedEndDate: calendarDate(5),
        probationMonths: 3,
        actualEndDate: null,
        evaluationType: 'REGULARIZATION',
        evaluation: '试用期考核已完成，建议转正。',
        result: '建议转正',
        confirmedDate: null,
        extensionCount: 0,
        status: ProcessStatus.PENDING,
        approval: {
          status: ProcessStatus.PENDING,
          approverUserId: 'demo-user-deptadmin',
          submittedAt: calendarDate(-1),
        },
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
      },
      {
        id: 'demo-probation-1003',
        employeeId: 'demo-employee-1003',
        organizationId: organizationId('CEO_SECOND_TMALL_SUPERMARKET'),
        positionName: '运营专员',
        jobTitleName: '运营专员',
        startDate: calendarDate(-95),
        plannedEndDate: calendarDate(-5),
        probationMonths: 3,
        actualEndDate: calendarDate(-2),
        evaluationType: 'REGULARIZATION',
        evaluation: '试用期考核通过。',
        result: '已转正',
        confirmedDate: calendarDate(-2),
        extensionCount: 0,
        status: ProcessStatus.COMPLETED,
        approval: {
          status: ProcessStatus.APPROVED,
          approverUserId: 'demo-user-admin',
          submittedAt: calendarDate(-10),
        },
        createdAt: new Date(createdAt),
        updatedAt: new Date(createdAt),
      },
    ];
  }

  private getOrganizationName(organizationId: string) {
    return organizations.find((organization) => organization.id === organizationId)?.name ?? '';
  }

  private assertUnique(employeeNo: string, idCardNo: string | null | undefined, exceptId?: string) {
    const normalizedEmployeeNo = employeeNo.toLocaleLowerCase();
    const duplicateEmployeeNo = this.employees.some(
      (employee) => employee.id !== exceptId && employee.employeeNo.toLocaleLowerCase() === normalizedEmployeeNo,
    );
    if (duplicateEmployeeNo) throw new ConflictException('工号已存在');
    if (!idCardNo) return;

    const normalizedIdCardNo = idCardNo.toUpperCase();
    const duplicateIdCardNo = this.employees.some(
      (employee) => employee.id !== exceptId
        && employee.idCardNo?.toUpperCase() === normalizedIdCardNo,
    );
    if (duplicateIdCardNo) throw new ConflictException('身份证号已存在');
  }
}
