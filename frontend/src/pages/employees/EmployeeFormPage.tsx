import { CloseOutlined } from '@ant-design/icons';
import { PERMISSIONS, type CreateEmployeeInput, type UpdateEmployeeInput } from '@hr-demo/shared';
import { Alert, App, Button, Result, Skeleton } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import {
  useCreateEmployee,
  useEmployee,
  useEmployeeFormOptions,
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
  const permission = editing ? PERMISSIONS.EMPLOYEE_UPDATE : PERMISSIONS.EMPLOYEE_CREATE;
  const allowed = Boolean(user?.permissions.includes(permission));
  const employee = useEmployee(id);
  const organizations = useOrganizations();
  const formOptions = useEmployeeFormOptions(id, allowed);
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee(id ?? '');
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

  if (organizations.isLoading || formOptions.isLoading || (editing && employee.isLoading)) {
    return <div className="employee-editor-loading"><Skeleton active paragraph={{ rows: 10 }} /></div>;
  }

  if (organizations.isError || formOptions.isError || (editing && (employee.isError || !employee.data))) {
    return (
      <Alert
        type="error"
        showIcon
        message={editing ? '无法加载员工编辑信息' : '无法加载部门列表'}
        description={employee.error?.message ?? formOptions.error?.message ?? organizations.error?.message}
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
    <section className="employee-editor-page" aria-labelledby="employee-form-heading">
      <header className="employee-editor-header">
        <h1 id="employee-form-heading">{editing ? '编辑员工' : '新增员工'}</h1>
        <Button
          type="text"
          className="employee-editor-close"
          aria-label="关闭员工编辑"
          icon={<CloseOutlined />}
          onClick={() => navigate(editing ? `/personnel/employees/${id}` : '/personnel/employees')}
        />
      </header>
      <main className="employee-editor-content">
        {mutation.isError ? (
          <Alert
            className="employee-editor-error"
            type="error"
            showIcon
            message="保存失败"
            description={mutation.error.message}
          />
        ) : null}
        <EmployeeForm
          formId={FORM_ID}
          employee={employee.data}
          organizations={organizations.data ?? []}
          formOptions={formOptions.data}
          onSubmit={handleSubmit}
        />
      </main>
      <footer className="employee-editor-footer">
        <Button onClick={() => navigate(editing ? `/personnel/employees/${id}` : '/personnel/employees')}>取消</Button>
        <Button type="primary" htmlType="submit" form={FORM_ID} loading={mutation.isPending}>保存</Button>
      </footer>
    </section>
  );
}
