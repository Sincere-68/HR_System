import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditAction, EmploymentStatus } from '@prisma/client';
import {
  PERMISSIONS,
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

const organizations: Organization[] = [
  { id: 'demo-org-hq', code: 'HQ', name: '总部', parentId: null },
  { id: 'demo-org-product', code: 'PRODUCT', name: '产品研发部', parentId: 'demo-org-hq' },
  { id: 'demo-org-operations', code: 'OPERATIONS', name: '运营部', parentId: 'demo-org-hq' },
  { id: 'demo-org-sales', code: 'SALES', name: '销售部', parentId: 'demo-org-hq' },
];

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
    ],
    organizationIds: ['demo-org-product', 'demo-org-operations'],
  },
  {
    id: 'demo-user-viewer',
    username: 'viewer',
    password: 'Demo@123',
    displayName: '普通查看者',
    role: 'VIEWER',
    roleName: '普通查看者',
    permissions: [PERMISSIONS.EMPLOYEE_READ, PERMISSIONS.ORGANIZATION_READ],
    organizationIds: ['demo-org-sales'],
  },
];

const initialEmployees = [
  {
    id: 'demo-employee-1001',
    employeeNo: 'DEMO-1001',
    name: '林知夏',
    mobile: '13800001001',
    idCardNo: '110101199203181021',
    organizationId: 'demo-org-product',
    status: EmploymentStatus.REGULAR,
  },
  {
    id: 'demo-employee-1002',
    employeeNo: 'DEMO-1002',
    name: '周予安',
    mobile: '13800001002',
    idCardNo: '310101199507092036',
    organizationId: 'demo-org-product',
    status: EmploymentStatus.REGULAR,
  },
  {
    id: 'demo-employee-2001',
    employeeNo: 'DEMO-2001',
    name: '陈嘉禾',
    mobile: '13800002001',
    idCardNo: '440101198911262412',
    organizationId: 'demo-org-operations',
    status: EmploymentStatus.RESIGNED,
  },
  {
    id: 'demo-employee-3001',
    employeeNo: 'DEMO-3001',
    name: '许星澜',
    mobile: '13800003001',
    idCardNo: '510101199604112527',
    organizationId: 'demo-org-sales',
    status: EmploymentStatus.REGULAR,
  },
] as const;

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
  private audits: DemoAuditRecord[] = [];
  private nextEmployeeNumber = 4001;

  constructor(config: ConfigService) {
    this.enabled = config.get<boolean>('DEMO_MODE', true);
    this.employees = this.createInitialEmployees();
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

  organizationExists(organizationId: string) {
    return organizations.some((organization) => organization.id === organizationId);
  }

  getEmployees() {
    return [...this.employees];
  }

  getEmployee(id: string) {
    return this.employees.find((employee) => employee.id === id);
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
    this.assertUnique(input.employeeNo ?? employee.employeeNo, employee.idCardNo, employee.id);

    if (input.employeeNo !== undefined) employee.employeeNo = input.employeeNo;
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
