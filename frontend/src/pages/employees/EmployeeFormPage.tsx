import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { PERMISSIONS, type CreateEmployeeInput, type UpdateEmployeeInput } from '@hr-demo/shared';
import { Alert, App, Button, Card, Result, Skeleton, Space, Typography } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import {
  useCreateEmployee,
  useEmployee,
  useOrganizations,
  useUpdateEmployee,
} from '../../features/employees/api';
import { EmployeeForm } from '../../features/employees/EmployeeForm';

const FORM_ID = 'employee-form';

export function EmployeeFormPage() {
  const { id } = useParams<{ id: string }>();
  const editing = Boolean(id);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const employee = useEmployee(id);
  const organizations = useOrganizations();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee(id ?? '');
  const permission = editing ? PERMISSIONS.EMPLOYEE_UPDATE : PERMISSIONS.EMPLOYEE_CREATE;
  const allowed = Boolean(user?.permissions.includes(permission));
  const mutation = editing ? updateEmployee : createEmployee;

  if (!allowed) {
    return (
      <Result
        status="403"
        title="无权执行此操作"
        subTitle="当前角色没有新增或编辑员工的权限。"
        extra={<Link to="/personnel/employees"><Button type="primary">返回人员列表</Button></Link>}
      />
    );
  }

  if (organizations.isLoading || (editing && employee.isLoading)) {
    return <Card bordered={false}><Skeleton active paragraph={{ rows: 8 }} /></Card>;
  }

  if (organizations.isError || (editing && (employee.isError || !employee.data))) {
    return (
      <Alert
        type="error"
        showIcon
        message={editing ? '无法加载员工编辑信息' : '无法加载部门列表'}
        description={employee.error?.message ?? organizations.error?.message}
      />
    );
  }

  const handleSubmit = async (input: CreateEmployeeInput | UpdateEmployeeInput) => {
    try {
      const saved = editing
        ? await updateEmployee.mutateAsync(input as UpdateEmployeeInput)
        : await createEmployee.mutateAsync(input as CreateEmployeeInput);
      message.success(editing ? '员工信息已更新' : '员工已新增');
      navigate(`/personnel/employees/${saved.id}`, { replace: true });
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : '保存失败');
    }
  };

  return (
    <section aria-labelledby="employee-form-heading">
      <div className="page-heading form-page-heading">
        <div>
          <Link className="back-link" to={editing ? `/personnel/employees/${id}` : '/personnel/employees'}>
            <ArrowLeftOutlined /> {editing ? '返回员工详情' : '返回人员列表'}
          </Link>
          <Typography.Title id="employee-form-heading" level={2}>
            {editing ? '编辑员工' : '新增员工'}
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            {editing ? '修改员工主档与当前任职状态' : '创建员工主档和首条任职记录'}
          </Typography.Paragraph>
        </div>
        <Space>
          <Link to={editing ? `/personnel/employees/${id}` : '/personnel/employees'}>
            <Button>取消</Button>
          </Link>
          <Button
            type="primary"
            htmlType="submit"
            form={FORM_ID}
            icon={<SaveOutlined />}
            loading={mutation.isPending}
          >
            保存
          </Button>
        </Space>
      </div>

      {mutation.isError ? (
        <Alert
          className="content-alert"
          type="error"
          showIcon
          message="保存失败"
          description={mutation.error.message}
        />
      ) : null}

      <Card bordered={false} title="员工主档" className="form-panel">
        <EmployeeForm
          formId={FORM_ID}
          employee={employee.data}
          organizations={organizations.data ?? []}
          canReadSensitive={Boolean(user?.permissions.includes(PERMISSIONS.EMPLOYEE_SENSITIVE_READ))}
          onSubmit={handleSubmit}
        />
      </Card>
    </section>
  );
}
