export const ROLE_CODES = ['ADMIN', 'DEPT_ADMIN', 'VIEWER'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

export const EMPLOYMENT_STATUSES = ['ACTIVE', 'INACTIVE'] as const;
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

export const PERMISSIONS = {
  EMPLOYEE_READ: 'employee.read',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_UPDATE: 'employee.update',
  EMPLOYEE_SENSITIVE_READ: 'employee.sensitive.read',
  EMPLOYEE_DATA_ALL: 'employee.data.all',
  ORGANIZATION_READ: 'organization.read',
} as const;
export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: RoleCode;
  roleName: string;
  permissions: PermissionCode[];
  organizationIds: string[];
}

export interface Organization {
  id: string;
  code: string;
  name: string;
  parentId: string | null;
}

export interface Employee {
  id: string;
  employeeNo: string;
  name: string;
  mobile: string;
  idCardNo: string;
  organizationId: string;
  organizationName: string;
  employmentStatus: EmploymentStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface EmployeeListQuery {
  keyword?: string;
  organizationId?: string;
  status?: EmploymentStatus;
  page?: number;
  pageSize?: number;
}

export interface CreateEmployeeInput {
  employeeNo: string;
  name: string;
  mobile: string;
  idCardNo: string;
  organizationId: string;
  employmentStatus: EmploymentStatus;
}

export type UpdateEmployeeInput = Partial<CreateEmployeeInput>;

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error?: string;
  path?: string;
  timestamp?: string;
}
