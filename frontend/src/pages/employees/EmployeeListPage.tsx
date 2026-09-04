import { ExportOutlined, EyeOutlined, ImportOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import {
  formatChinaAdministrativeRegion,
  PERMISSIONS,
  type EmployeeListItem,
  type EmployeeListQuery,
  type EmploymentRelationship,
  type EmploymentStatus,
  type InternListQuery,
  type PersonnelLaborWorkerListItem,
  type PersonnelLaborWorkerListQuery,
  type PersonnelResignedListItem,
  type PersonnelResignedListQuery,
  type RegularEmployeeListItem,
  type RegularEmployeeListQuery,
} from '@hr-demo/shared';
import { Alert, Button, DatePicker, Empty, Input, Table, Typography } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckboxFilterDropdown } from '../../components/CheckboxFilterDropdown';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import {
  bankNameLabels,
  educationLevelLabels,
  employeeLevelLabels,
  employmentRelationshipLabels,
  ethnicityLabels,
  householdTypeLabels,
  institutionTypeLabels,
  identityDocumentTypeLabels,
  maritalStatusLabels,
  personnelCategoryLabels,
  personnelPositionLabels,
  personnelSourceLabels,
  politicalStatusLabels,
  workArrangementLabels,
} from '../../config/personnel-fields';
import { useAuth } from '../../features/auth/auth-context';
import { PersonnelExportDialog } from '../../features/employees/PersonnelExportDialog';
import { TableExportDialog } from '../../features/employees/TableExportDialog';
import { PersonnelImportDialog } from '../../features/employees/PersonnelImportDialog';
import { downloadTableExport } from '../../features/employees/download';
import {
  useEmployees,
  useOrganizations,
  usePersonnelLaborWorkers,
  usePersonnelResigned,
  useRegularEmployees,
} from '../../features/employees/api';
import { employmentStatusLabels, EmploymentStatusTag } from '../../features/employees/status';
import { useInterns } from '../../features/employment/api';
import { internColumns } from '../employment/InternManagementPage';

const personnelViews = ['all', 'regular', 'intern', 'labor', 'resigned'] as const;
type PersonnelView = (typeof personnelViews)[number];

const personnelViewCards: Array<{ view: PersonnelView; label: string }> = [
  { view: 'all', label: '全部在职' },
  { view: 'regular', label: '正式人员' },
  { view: 'intern', label: '实习生' },
  { view: 'labor', label: '劳务人员' },
  { view: 'resigned', label: '离职人员' },
];

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function isPersonnelView(value: string | null): value is PersonnelView {
  return Boolean(value && personnelViews.includes(value as PersonnelView));
}

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

function displayValue(value: string | number | null | undefined) {
  return value === null || value === undefined || value === '' ? '--' : value;
}

function renderEmployeeDetailAction(employeeId: string, canViewEmployeeDetail: boolean) {
  if (!canViewEmployeeDetail) {
    return <Button type="link" size="small" disabled>暂无详情</Button>;
  }

  return (
    <Link to={`/personnel/employees/${employeeId}`}>
      <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
    </Link>
  );
}

const employeeColumns: ColumnsType<EmployeeListItem> = [
  { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left' },
  {
    title: '姓名',
    dataIndex: 'name',
    width: 112,
    fixed: 'left',
    render: (name: string, employee) => (
      <Link to={`/personnel/employees/${employee.id}`}>{name}</Link>
    ),
  },
  { title: '部门', dataIndex: 'organizationName', width: 144, render: displayValue },
  { title: '入职日期', dataIndex: 'entryDate', width: 96, render: displayValue },
  { title: '职位', dataIndex: 'positionName', width: 120, render: displayValue },
  { title: '性别', dataIndex: 'gender', width: 90, render: (value) => displayValue(value ? genderLabels[value] : null) },
  { title: '人员定位', dataIndex: 'personnelPosition', width: 120, render: (value) => displayValue(value ? personnelPositionLabels[value as keyof typeof personnelPositionLabels] ?? value : null) },
  { title: '职级', dataIndex: 'jobLevel', width: 110, render: displayValue },
  { title: '员工层级', dataIndex: 'employeeLevel', width: 120, render: (value) => displayValue(value ? employeeLevelLabels[value as keyof typeof employeeLevelLabels] ?? value : null) },
  { title: '工作地点', dataIndex: 'workplaceName', width: 140, render: displayValue },
  { title: '企业邮箱', dataIndex: 'workEmail', width: 220, render: displayValue },
  { title: '个人邮箱', dataIndex: 'personalEmail', width: 220, render: displayValue },
  { title: '手机号码', dataIndex: 'mobile', width: 150, render: displayValue },
  {
    title: '人员类别',
    dataIndex: 'personnelCategory',
    width: 120,
    render: (value) => displayValue(value ? personnelCategoryLabels[value as keyof typeof personnelCategoryLabels] ?? value : null),
  },
  { title: '人员来源', dataIndex: 'personnelSource', width: 120, render: (value) => displayValue(value ? personnelSourceLabels[value as keyof typeof personnelSourceLabels] ?? value : null) },
  {
    title: '人员状态',
    dataIndex: 'employmentStatus',
    width: 120,
    render: (status: EmploymentStatus) => <EmploymentStatusTag status={status} />,
  },
  { title: '全日制公司', dataIndex: 'fullTimeCompany', width: 150, render: displayValue },
  { title: '雇佣关系', dataIndex: 'employmentRelationship', width: 120, render: (value) => displayValue(value ? employmentRelationshipLabels[value as keyof typeof employmentRelationshipLabels] ?? value : null) },
  {
    title: '用工形式',
    dataIndex: 'workArrangement',
    width: 110,
    render: (value) => displayValue(value ? workArrangementLabels[value as keyof typeof workArrangementLabels] ?? value : null),
  },
  { title: '直线经理', dataIndex: 'managerName', width: 120, render: displayValue },
  { title: '直线经理邮箱', dataIndex: 'managerEmail', width: 220, render: displayValue },
  { title: '累计工龄（年）', dataIndex: 'totalWorkYears', width: 140, render: displayValue },
  { title: '累计司龄（年）', dataIndex: 'totalServiceYears', width: 140, render: displayValue },
  {
    title: '证件类型',
    dataIndex: 'documentType',
    width: 130,
    render: (value) => displayValue(value ? identityDocumentTypeLabels[value as keyof typeof identityDocumentTypeLabels] ?? value : null),
  },
  { title: '证件号码', dataIndex: 'documentNumber', width: 200, render: displayValue },
  { title: '证件截止日期', dataIndex: 'documentExpiryDate', width: 140, render: displayValue },
  { title: '出生日期', dataIndex: 'birthDate', width: 120, render: displayValue },
  { title: '年龄', dataIndex: 'age', width: 90, render: displayValue },
  { title: '民族', dataIndex: 'ethnicity', width: 100, render: (value) => displayValue(value ? ethnicityLabels[value as keyof typeof ethnicityLabels] ?? value : null) },
  { title: '婚姻状况', dataIndex: 'maritalStatus', width: 110, render: (value) => displayValue(value ? maritalStatusLabels[value as keyof typeof maritalStatusLabels] ?? value : null) },
  { title: '政治面貌', dataIndex: 'politicalStatus', width: 120, render: (value) => displayValue(value ? politicalStatusLabels[value as keyof typeof politicalStatusLabels] ?? value : null) },
  { title: '籍贯地区', dataIndex: 'nativePlaceRegionCode', width: 200, render: (value) => displayValue(formatChinaAdministrativeRegion(value)) },
  { title: '籍贯详细说明', dataIndex: 'nativePlace', width: 160, render: displayValue },
  { title: '户口类别', dataIndex: 'householdType', width: 120, render: (value) => displayValue(value ? householdTypeLabels[value as keyof typeof householdTypeLabels] ?? value : null) },
  { title: '户籍所在地地区', dataIndex: 'householdRegionCode', width: 200, render: (value) => displayValue(formatChinaAdministrativeRegion(value)) },
  { title: '户籍详细地址', dataIndex: 'householdAddress', width: 240, render: displayValue },
  { title: '联系地址地区', dataIndex: 'residentialRegionCode', width: 200, render: (value) => displayValue(formatChinaAdministrativeRegion(value)) },
  { title: '联系详细地址', dataIndex: 'residentialAddress', width: 240, render: displayValue },
  { title: '紧急联系人', dataIndex: 'emergencyContactName', width: 130, render: displayValue },
  { title: '与本人关系', dataIndex: 'emergencyContactRelationship', width: 120, render: displayValue },
  { title: '紧急联系人电话', dataIndex: 'emergencyContactMobile', width: 160, render: displayValue },
  { title: '银行', dataIndex: 'bankName', width: 150, render: (value) => displayValue(value ? bankNameLabels[value as keyof typeof bankNameLabels] ?? value : null) },
  { title: '开户行支行', dataIndex: 'bankBranchName', width: 180, render: displayValue },
  { title: '银行账号', dataIndex: 'bankAccountNumber', width: 200, render: displayValue },
  { title: '毕业学校名称', dataIndex: 'graduationSchoolName', width: 200, render: displayValue },
  { title: '院校类型', dataIndex: 'institutionType', width: 120, render: (value) => displayValue(value ? institutionTypeLabels[value as keyof typeof institutionTypeLabels] ?? value : null) },
  { title: '最高学历', dataIndex: 'highestEducation', width: 110, render: (value) => displayValue(value ? educationLevelLabels[value as keyof typeof educationLevelLabels] ?? value : null) },
  { title: '毕业时间', dataIndex: 'graduationDate', width: 120, render: displayValue },
  { title: '专业', dataIndex: 'major', width: 160, render: displayValue },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, employee) => (
      <Link to={`/personnel/employees/${employee.id}`}>
        <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
      </Link>
    ),
  },
];

const regularEmployeeColumns: ColumnsType<RegularEmployeeListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, fixed: 'left', render: displayValue },
  { title: '工号', dataIndex: 'employeeNo', width: 130, fixed: 'left', render: displayValue },
  { title: '入职日期', dataIndex: 'entryDate', width: 130, render: displayValue },
  { title: '部门', dataIndex: 'departmentName', width: 160, render: displayValue },
  { title: '职位', dataIndex: 'positionName', width: 150, render: displayValue },
  { title: '职级', dataIndex: 'jobLevel', width: 110, render: displayValue },
  { title: '性别', dataIndex: 'gender', width: 90, render: (value) => displayValue(value ? genderLabels[value] : null) },
  { title: '企业邮箱', dataIndex: 'workEmail', width: 220, render: displayValue },
  {
    title: '用工形式',
    dataIndex: 'workArrangement',
    width: 120,
    render: (value) => displayValue(workArrangementLabels[value as keyof typeof workArrangementLabels] ?? value),
  },
  { title: '直线经理', dataIndex: 'managerName', width: 130, render: displayValue },
  { title: '简历信息', dataIndex: 'resumeInfo', width: 120, render: displayValue },
  { title: '面试评价', dataIndex: 'interviewEvaluation', width: 120, render: displayValue },
  { title: '银行', dataIndex: 'bankName', width: 150, render: (value) => displayValue(value ? bankNameLabels[value as keyof typeof bankNameLabels] ?? value : null) },
  { title: '银行账号', dataIndex: 'bankAccountNumber', width: 200, render: displayValue },
  { title: '开户行支行', dataIndex: 'bankBranchName', width: 180, render: displayValue },
  { title: '全日制公司', dataIndex: 'fullTimeCompany', width: 180, render: displayValue },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, employee) => renderEmployeeDetailAction(employee.employeeId, employee.canViewEmployeeDetail),
  },
];

const personnelLaborWorkerColumns: ColumnsType<PersonnelLaborWorkerListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, fixed: 'left', render: displayValue },
  { title: '电子邮箱', dataIndex: 'workEmail', width: 220, render: displayValue },
  { title: '工号', dataIndex: 'employeeNo', width: 130, render: displayValue },
  { title: '入职日期', dataIndex: 'entryDate', width: 130, render: displayValue },
  { title: '部门', dataIndex: 'departmentName', width: 160, render: displayValue },
  { title: '职务', dataIndex: 'jobTitleName', width: 150, render: displayValue },
  { title: '职位', dataIndex: 'positionName', width: 150, render: displayValue },
  {
    title: '用工形式',
    dataIndex: 'workArrangement',
    width: 120,
    render: (value) => displayValue(workArrangementLabels[value as keyof typeof workArrangementLabels] ?? value),
  },
  { title: '直线经理', dataIndex: 'managerName', width: 130, render: displayValue },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, employee) => renderEmployeeDetailAction(employee.employeeId, employee.canViewEmployeeDetail),
  },
];

const personnelResignedColumns: ColumnsType<PersonnelResignedListItem> = [
  { title: '工号', dataIndex: 'employeeNo', width: 130, fixed: 'left', render: displayValue },
  { title: '姓名', dataIndex: 'name', width: 120, fixed: 'left', render: displayValue },
  { title: '部门', dataIndex: 'departmentName', width: 160, render: displayValue },
  { title: '性别', dataIndex: 'gender', width: 90, render: (value) => displayValue(value ? genderLabels[value] : null) },
  { title: '入职日期', dataIndex: 'entryDate', width: 130, render: displayValue },
  { title: '离职前职位', dataIndex: 'previousPositionName', width: 150, render: displayValue },
  { title: '离职原因', dataIndex: 'terminationReason', width: 220, ellipsis: true, render: displayValue },
  { title: '异动类型', dataIndex: 'movementType', width: 120, render: displayValue },
  {
    title: '最后工作日',
    dataIndex: 'lastWorkingDate',
    width: 165,
    render: (date: string, employee) => (
      <span>
        {displayValue(date)}
        <Typography.Text type="secondary">（{employee.lastWorkingDateBasis === 'ACTUAL' ? '实际' : '计划'}）</Typography.Text>
      </span>
    ),
  },
  { title: '全日制公司', dataIndex: 'fullTimeCompany', width: 180, render: displayValue },
  { title: '证件号码', dataIndex: 'documentNumber', width: 200, render: displayValue },
  { title: '手机号码', dataIndex: 'mobile', width: 150, render: displayValue },
];

export function EmployeeListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [secondaryExportOpen, setSecondaryExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const requestedView = searchParams.get('view');
  const view: PersonnelView = isPersonnelView(requestedView) ? requestedView : 'all';
  const [keywordInput, setKeywordInput] = useState(searchParams.get('keyword') ?? '');
  const [nameInput, setNameInput] = useState(searchParams.get('name') ?? '');

  const employeeQuery = useMemo<EmployeeListQuery>(() => ({
    name: searchParams.get('name') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    status: (searchParams.get('status') as EmploymentStatus | null) ?? undefined,
    employmentRelationship: (searchParams.get('employmentRelationship') as EmploymentRelationship | null) ?? undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const regularQuery = useMemo<RegularEmployeeListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const internQuery = useMemo<InternListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    startDateFrom: searchParams.get('startDateFrom') || undefined,
    startDateTo: searchParams.get('startDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const laborQuery = useMemo<PersonnelLaborWorkerListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    entryDateFrom: searchParams.get('entryDateFrom') || undefined,
    entryDateTo: searchParams.get('entryDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const resignedQuery = useMemo<PersonnelResignedListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    lastWorkingDateFrom: searchParams.get('lastWorkingDateFrom') || undefined,
    lastWorkingDateTo: searchParams.get('lastWorkingDateTo') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);

  const employees = useEmployees(employeeQuery);
  const regularEmployees = useRegularEmployees(regularQuery);
  const interns = useInterns(internQuery);
  const laborWorkers = usePersonnelLaborWorkers(laborQuery);
  const resignedEmployees = usePersonnelResigned(resignedQuery);
  const organizations = useOrganizations();
  const canCreate = Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_CREATE));
  const canExport = Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_READ));
  const canImport = Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_UPDATE));

  useEffect(() => {
    setSelectedRowKeys([]);
  }, [searchParams]);

  useEffect(() => {
    setKeywordInput(searchParams.get('keyword') ?? '');
    setNameInput(searchParams.get('name') ?? '');
  }, [searchParams]);

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const switchView = (nextView: PersonnelView) => {
    const retainedKeys: Record<PersonnelView, readonly string[]> = {
      all: ['name', 'organizationId', 'status', 'employmentRelationship', 'pageSize'],
      regular: ['keyword', 'organizationId', 'pageSize'],
      intern: ['keyword', 'startDateFrom', 'startDateTo', 'pageSize'],
      labor: ['keyword', 'entryDateFrom', 'entryDateTo', 'pageSize'],
      resigned: ['keyword', 'lastWorkingDateFrom', 'lastWorkingDateTo', 'pageSize'],
    };
    const next = new URLSearchParams();
    retainedKeys[nextView].forEach((key) => {
      const value = searchParams.get(key);
      if (value) next.set(key, value);
    });
    next.set('view', nextView);
    next.set('page', '1');
    setSearchParams(next, { replace: true });
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  const statusOptions = Object.entries(employmentStatusLabels).map(([value, label]) => ({
    label,
    value,
  }));
  const employmentRelationshipOptions = Object.entries(employmentRelationshipLabels).map(([value, label]) => ({
    label,
    value,
  }));

  const activeQuery = view === 'all'
    ? employees
    : view === 'regular'
      ? regularEmployees
      : view === 'intern'
        ? interns
        : view === 'labor'
          ? laborWorkers
          : resignedEmployees;
  const activeLabel = personnelViewCards.find((card) => card.view === view)?.label ?? '人员';
  const secondaryExportColumns = view === 'regular' ? regularEmployeeColumns
    : view === 'intern' ? internColumns
      : view === 'labor' ? personnelLaborWorkerColumns
        : personnelResignedColumns;
  const secondaryExportFields = secondaryExportColumns
    .flatMap((column) => ('dataIndex' in column && typeof column.title === 'string' && typeof column.dataIndex === 'string'
      ? [{ key: column.dataIndex, title: column.title }]
      : []));
  const secondaryExportEndpoint = view === 'regular' ? '/employees/regular/export'
    : view === 'intern' ? '/employment/interns/export'
      : view === 'labor' ? '/employment/personnel-labor-workers/export'
        : '/employment/personnel-resigned/export';
  const cardTotals: Record<PersonnelView, number | string> = {
    all: employees.data?.meta.total ?? '--',
    regular: regularEmployees.data?.meta.total ?? '--',
    intern: interns.data?.meta.total ?? '--',
    labor: laborWorkers.data?.meta.total ?? '--',
    resigned: resignedEmployees.data?.meta.total ?? '--',
  };

  const searchInput = (label: string, placeholder: string) => (
    <Input.Search
      className="personnel-view-keyword-input"
      allowClear
      aria-label={label}
      placeholder={placeholder}
      value={keywordInput}
      onChange={(event) => {
        setKeywordInput(event.target.value);
        if (!event.target.value) patchSearch({ keyword: undefined, page: 1 });
      }}
      onSearch={(keyword) => patchSearch({ keyword: keyword.trim() || undefined, page: 1 })}
    />
  );

  const nameSearchInput = (
    <Input.Search
      className="personnel-view-keyword-input"
      allowClear
      aria-label="按姓名搜索"
      placeholder="请输入姓名"
      value={nameInput}
      onChange={(event) => {
        setNameInput(event.target.value);
        if (!event.target.value) patchSearch({ name: undefined, page: 1 });
      }}
      onSearch={(name) => patchSearch({ name: name.trim() || undefined, page: 1 })}
    />
  );

  const pagination = {
    current: employeeQuery.page,
    pageSize: employeeQuery.pageSize,
    total: activeQuery.data?.meta.total ?? 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50],
    showTotal: (total: number, range: [number, number]) => `${range[0]}-${range[1]} / 共 ${total} 条`,
  };

  const currentToolbar = (() => {
    if (view === 'all') {
      return (
        <div className="employee-filter-toolbar">
          <div className="employee-filter-controls">
            {nameSearchInput}
            <OrganizationTreeSelect
              aria-label="筛选部门"
              className="department-filter-tree-select"
              variant="borderless"
              allowClear
              organizations={organizations.data ?? []}
              placeholder="部门"
              value={employeeQuery.organizationId}
              onChange={(organizationId) => patchSearch({ organizationId, page: 1 })}
            />
            <CheckboxFilterDropdown
              label="雇佣关系"
              options={employmentRelationshipOptions}
              value={employeeQuery.employmentRelationship ? [employeeQuery.employmentRelationship] : []}
              onChange={(values) => patchSearch({ employmentRelationship: values.at(-1), page: 1 })}
            />
            <CheckboxFilterDropdown
              label="人员状态"
              options={statusOptions}
              value={employeeQuery.status ? [employeeQuery.status] : []}
              onChange={(values) => patchSearch({ status: values.at(-1), page: 1 })}
            />
          </div>
          <div className="employee-selection-summary" aria-live="polite">
            <Typography.Text type="secondary">已选择 {selectedRowKeys.length} 人</Typography.Text>
            {selectedRowKeys.length > 0 ? (
              <Button type="link" size="small" onClick={() => setSelectedRowKeys([])}>清空已选</Button>
            ) : null}
          </div>
        </div>
      );
    }

    if (view === 'regular') {
      return (
        <div className="employee-filter-toolbar personnel-view-filter-toolbar">
          <div className="personnel-view-filter-controls">
            {searchInput('搜索正式人员', '搜索姓名或工号')}
            <OrganizationTreeSelect
              aria-label="筛选部门"
              className="department-filter-tree-select"
              variant="borderless"
              allowClear
              organizations={organizations.data ?? []}
              placeholder="部门"
              value={regularQuery.organizationId}
              onChange={(organizationId) => patchSearch({ organizationId, page: 1 })}
            />
          </div>
          <Typography.Text type="secondary">共 {regularEmployees.data?.meta.total ?? 0} 条</Typography.Text>
        </div>
      );
    }

    if (view === 'intern') {
      return (
        <div className="employee-filter-toolbar personnel-view-filter-toolbar">
          <div className="personnel-view-filter-controls">
            {searchInput('搜索实习生', '搜索姓名或工号')}
            <DatePicker.RangePicker
              aria-label="筛选实习开始日期"
              value={internQuery.startDateFrom && internQuery.startDateTo
                ? [dayjs(internQuery.startDateFrom), dayjs(internQuery.startDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                startDateFrom: dates[0] || undefined,
                startDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
          <Typography.Text type="secondary">共 {interns.data?.meta.total ?? 0} 条</Typography.Text>
        </div>
      );
    }

    if (view === 'labor') {
      return (
        <div className="employee-filter-toolbar personnel-view-filter-toolbar">
          <div className="personnel-view-filter-controls">
            {searchInput('搜索劳务人员', '搜索姓名或工号')}
            <DatePicker.RangePicker
              aria-label="筛选劳务人员入职日期"
              value={laborQuery.entryDateFrom && laborQuery.entryDateTo
                ? [dayjs(laborQuery.entryDateFrom), dayjs(laborQuery.entryDateTo)]
                : null}
              onChange={(_, dates) => patchSearch({
                entryDateFrom: dates[0] || undefined,
                entryDateTo: dates[1] || undefined,
                page: 1,
              })}
            />
          </div>
          <Typography.Text type="secondary">共 {laborWorkers.data?.meta.total ?? 0} 条</Typography.Text>
        </div>
      );
    }

    return (
      <div className="employee-filter-toolbar personnel-view-filter-toolbar">
        <div className="personnel-view-filter-controls">
          {searchInput('搜索离职人员', '搜索姓名或工号')}
          <DatePicker.RangePicker
            aria-label="筛选最后工作日"
            value={resignedQuery.lastWorkingDateFrom && resignedQuery.lastWorkingDateTo
              ? [dayjs(resignedQuery.lastWorkingDateFrom), dayjs(resignedQuery.lastWorkingDateTo)]
              : null}
            onChange={(_, dates) => patchSearch({
              lastWorkingDateFrom: dates[0] || undefined,
              lastWorkingDateTo: dates[1] || undefined,
              page: 1,
            })}
          />
        </div>
        <Typography.Text type="secondary">共 {resignedEmployees.data?.meta.total ?? 0} 条</Typography.Text>
      </div>
    );
  })();

  const currentTable = (() => {
    if (view === 'all') {
      return (
        <Table<EmployeeListItem>
          className="employee-table"
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            preserveSelectedRowKeys: false,
            onChange: setSelectedRowKeys,
          }}
          loading={employees.isLoading}
          columns={employeeColumns}
          dataSource={employees.data?.data ?? []}
          scroll={{ x: 7_200 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的员工" /> }}
          pagination={pagination}
          onChange={handleTableChange}
        />
      );
    }

    if (view === 'regular') {
      return (
        <Table<RegularEmployeeListItem>
          className="employee-table personnel-view-table"
          rowKey="employeeId"
          rowSelection={{ columnWidth: 38 }}
          loading={regularEmployees.isLoading}
          columns={regularEmployeeColumns}
          dataSource={regularEmployees.data?.data ?? []}
          scroll={{ x: 2_500 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的正式人员" /> }}
          pagination={pagination}
          onChange={handleTableChange}
        />
      );
    }

    if (view === 'intern') {
      return (
        <Table
          className="employee-table intern-table"
          rowKey="id"
          rowSelection={{ columnWidth: 38 }}
          loading={interns.isLoading}
          columns={internColumns}
          dataSource={interns.data?.data ?? []}
          scroll={{ x: 1_650 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的实习生任职记录" /> }}
          pagination={pagination}
          onChange={handleTableChange}
        />
      );
    }

    if (view === 'labor') {
      return (
        <Table<PersonnelLaborWorkerListItem>
          className="employee-table personnel-view-table"
          rowKey="employeeId"
          rowSelection={{ columnWidth: 38 }}
          loading={laborWorkers.isLoading}
          columns={personnelLaborWorkerColumns}
          dataSource={laborWorkers.data?.data ?? []}
          scroll={{ x: 1_650 }}
          sticky={{ offsetHeader: 48, offsetScroll: 0 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的当前劳务人员" /> }}
          pagination={pagination}
          onChange={handleTableChange}
        />
      );
    }

    return (
      <Table<PersonnelResignedListItem>
        className="employee-table personnel-view-table"
        rowKey="id"
        rowSelection={{ columnWidth: 38 }}
        loading={resignedEmployees.isLoading}
        columns={personnelResignedColumns}
        dataSource={resignedEmployees.data?.data ?? []}
        scroll={{ x: 1_850 }}
        sticky={{ offsetHeader: 48, offsetScroll: 0 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的已完成离职人员" /> }}
        pagination={pagination}
        onChange={handleTableChange}
      />
    );
  })();

  return (
    <section className="employee-list-page" aria-labelledby="employees-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><TeamOutlined /></span>
          <h1 id="employees-heading">人员</h1>
        </div>
        <div className="employee-page-actions">
          {view === 'all' && canImport ? (
            <Button icon={<ImportOutlined />} onClick={() => setImportOpen(true)}>导入</Button>
          ) : null}
          {canExport ? (
            <Button icon={<ExportOutlined />} onClick={() => view === 'all' ? setExportOpen(true) : setSecondaryExportOpen(true)}>导出</Button>
          ) : null}
          {canCreate ? (
            <Link to="/personnel/employees/new">
              <Button type="primary" icon={<PlusOutlined />}>新增人员</Button>
            </Link>
          ) : null}
        </div>
      </header>

      {view !== 'all' ? (
        <TableExportDialog
          open={secondaryExportOpen}
          title={`导出${activeLabel}`}
          fields={secondaryExportFields}
          selectedRowIds={selectedRowKeys.map(String)}
          onClose={() => setSecondaryExportOpen(false)}
          onExport={(input) => downloadTableExport(secondaryExportEndpoint, {
            ...input,
            query: (view === 'regular' ? regularQuery : view === 'intern' ? internQuery : view === 'labor' ? laborQuery : resignedQuery) as Record<string, string | number | undefined>,
          }, `${activeLabel}导出`)}
        />
      ) : null}
      <PersonnelImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => activeQuery.refetch()}
      />
      <PersonnelExportDialog
        open={exportOpen}
        selectedEmployeeIds={selectedRowKeys.map(String)}
        query={{
          name: employeeQuery.name,
          organizationId: employeeQuery.organizationId,
          status: employeeQuery.status,
          employmentRelationship: employeeQuery.employmentRelationship,
        }}
        onClose={() => setExportOpen(false)}
      />

      <div className="employee-overview" aria-label="人员分类">
        {personnelViewCards.map((card) => (
          <button
            className={`employee-overview-card${view === card.view ? ' is-active' : ''}`}
            key={card.view}
            type="button"
            aria-pressed={view === card.view}
            onClick={() => switchView(card.view)}
          >
            <span>{card.label}</span>
            <strong>{cardTotals[card.view]}</strong>
          </button>
        ))}
      </div>

      {activeQuery.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message={`${activeLabel}加载失败`}
          description={activeQuery.error.message}
          action={<Button size="small" onClick={() => activeQuery.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        {currentToolbar}
        {currentTable}
      </div>
    </section>
  );
}
