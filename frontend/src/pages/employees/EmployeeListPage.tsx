import { EditOutlined, EyeOutlined, PlusOutlined, TeamOutlined } from '@ant-design/icons';
import { PERMISSIONS, type Employee, type EmployeeListQuery, type EmploymentStatus } from '@hr-demo/shared';
import { Alert, Button, Empty, Space, Table } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import { useEmployees, useOrganizations } from '../../features/employees/api';
import { employmentStatusLabels, EmploymentStatusTag } from '../../features/employees/status';
import { CheckboxFilterDropdown, type CheckboxFilterOption } from '../../components/CheckboxFilterDropdown';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function EmployeeListPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedFilters, setSelectedFilters] = useState<Record<string, string[]>>({});

  const query = useMemo<EmployeeListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    status: (searchParams.get('status') as EmploymentStatus | null) ?? undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);

  const employees = useEmployees(query);
  const organizations = useOrganizations();
  const canCreate = Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_CREATE));
  const canUpdate = Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_UPDATE));
  const overview = [
    { label: '全部在职', value: employees.data?.meta.total ?? '--', emphasized: true },
    { label: '正式人员', value: '--' },
    { label: '实习生', value: '--' },
    { label: '劳务人员', value: '--' },
    { label: '离职人员', value: '--' },
  ];

  const patchSearch = (changes: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  };

  const handleTableChange = (pagination: TablePaginationConfig) => {
    patchSearch({ page: pagination.current ?? 1, pageSize: pagination.pageSize ?? 10 });
  };

  const columns: ColumnsType<Employee> = [
    {
      title: '工号',
      dataIndex: 'employeeNo',
      width: 140,
      sorter: (a, b) => a.employeeNo.localeCompare(b.employeeNo),
    },
    {
      title: '姓名',
      dataIndex: 'name',
      width: 130,
      render: (name: string, employee) => <Link to={`/personnel/employees/${employee.id}`}>{name}</Link>,
    },
    { title: '所属部门', dataIndex: 'organizationName', width: 180 },
    {
      title: '任职状态',
      dataIndex: 'employmentStatus',
      width: 120,
      render: (status: EmploymentStatus) => <EmploymentStatusTag status={status} />,
    },
    { title: '手机号', dataIndex: 'mobile', width: 150 },
    {
      title: '操作',
      key: 'actions',
      fixed: 'right',
      width: canUpdate ? 150 : 82,
      render: (_, employee) => (
        <Space size={4}>
          <Link to={`/personnel/employees/${employee.id}`}>
            <Button type="link" size="small" icon={<EyeOutlined />}>查看</Button>
          </Link>
          {canUpdate ? (
            <Link to={`/personnel/employees/${employee.id}/edit`}>
              <Button type="link" size="small" icon={<EditOutlined />}>编辑</Button>
            </Link>
          ) : null}
        </Space>
      ),
    },
  ];

  const employeeFilterOptions: CheckboxFilterOption[] = (employees.data?.data ?? []).map((employee) => ({
    label: `${employee.name} (${employee.employeeNo})`,
    value: employee.id,
  }));
  const departmentFilterOptions: CheckboxFilterOption[] = (organizations.data ?? []).map((organization) => ({
    label: organization.name,
    value: organization.id,
  }));
  const statusFilterOptions: CheckboxFilterOption[] = Object.entries(employmentStatusLabels).map(([value, label]) => ({
    label,
    value,
  }));

  return (
    <section className="employee-list-page" aria-labelledby="employees-heading">
      <header className="employee-page-heading">
        <div className="employee-title-group">
          <span className="employee-title-icon" aria-hidden="true"><TeamOutlined /></span>
          <h1 id="employees-heading">人员</h1>
        </div>
        {canCreate ? (
          <Link to="/personnel/employees/new">
            <Button type="primary" icon={<PlusOutlined />}>新增员工</Button>
          </Link>
        ) : null}
      </header>

      <div className="employee-overview" aria-label="人员统计概览">
        {overview.map((metric) => (
          <div className={`employee-overview-card${metric.emphasized ? ' is-emphasized' : ''}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </div>
        ))}
      </div>

      {employees.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="人员列表加载失败"
          description={employees.error.message}
          action={<Button size="small" onClick={() => employees.refetch()}>重试</Button>}
        />
      ) : null}

      <div className="employee-table-surface">
        <div className="employee-filter-row">
          <CheckboxFilterDropdown
            label="人员"
            options={employeeFilterOptions}
            value={selectedFilters.employee ?? []}
            onChange={(values) => setSelectedFilters((current) => ({ ...current, employee: values }))}
          />
          <CheckboxFilterDropdown
            label="部门"
            options={departmentFilterOptions}
            value={selectedFilters.department ?? []}
            onChange={(values) => setSelectedFilters((current) => ({ ...current, department: values }))}
          />
          <CheckboxFilterDropdown
            label="任职状态"
            options={statusFilterOptions}
            value={selectedFilters.status ?? []}
            onChange={(values) => setSelectedFilters((current) => ({ ...current, status: values }))}
          />
        </div>
        <Table<Employee>
          className="employee-table"
          rowKey="id"
          loading={employees.isLoading}
          columns={columns}
          dataSource={employees.data?.data ?? []}
          scroll={{ x: 900 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有符合条件的员工" /> }}
          pagination={{
            current: query.page,
            pageSize: query.pageSize,
            total: employees.data?.meta.total ?? 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, range) => `${range[0]}-${range[1]} / 共 ${total} 条`,
          }}
          onChange={handleTableChange}
        />
      </div>
    </section>
  );
}
