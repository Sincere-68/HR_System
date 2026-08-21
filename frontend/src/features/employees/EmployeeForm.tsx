import type { CreateEmployeeInput, Employee, Organization, UpdateEmployeeInput } from '@hr-demo/shared';
import { Alert, Form, Input, Select } from 'antd';
import { useEffect } from 'react';
import { employmentStatusLabels } from './status';

export type EmployeeFormValues = CreateEmployeeInput;

interface EmployeeFormProps {
  employee?: Employee;
  organizations: Organization[];
  canReadSensitive: boolean;
  onSubmit: (values: CreateEmployeeInput | UpdateEmployeeInput) => void;
  formId: string;
}

export function EmployeeForm({
  employee,
  organizations,
  canReadSensitive,
  onSubmit,
  formId,
}: EmployeeFormProps) {
  const [form] = Form.useForm<EmployeeFormValues>();
  const editingMaskedEmployee = Boolean(employee && !canReadSensitive);

  useEffect(() => {
    if (employee) {
      form.setFieldsValue({
        employeeNo: employee.employeeNo,
        name: employee.name,
        mobile: canReadSensitive ? employee.mobile : '',
        idCardNo: canReadSensitive ? employee.idCardNo : '',
        organizationId: employee.organizationId,
        employmentStatus: employee.employmentStatus,
      });
    } else {
      form.setFieldsValue({ employmentStatus: 'ACTIVE' });
    }
  }, [canReadSensitive, employee, form]);

  const handleFinish = (values: EmployeeFormValues) => {
    if (!employee) {
      onSubmit(values);
      return;
    }
    const payload: UpdateEmployeeInput = {
      employeeNo: values.employeeNo,
      name: values.name,
      organizationId: values.organizationId,
      employmentStatus: values.employmentStatus,
    };
    if (values.mobile?.trim()) payload.mobile = values.mobile.trim();
    if (values.idCardNo?.trim()) payload.idCardNo = values.idCardNo.trim();
    onSubmit(payload);
  };

  return (
    <Form<EmployeeFormValues>
      id={formId}
      form={form}
      layout="vertical"
      requiredMark="optional"
      onFinish={handleFinish}
      className="employee-form"
    >
      {editingMaskedEmployee ? (
        <Alert
          className="sensitive-edit-alert"
          type="info"
          showIcon
          message="当前账号无敏感字段查看权限"
          description="手机号和身份证号不会回填。留空表示保持原值，只有输入新值时才会更新。"
        />
      ) : null}
      <div className="form-grid">
        <Form.Item
          name="employeeNo"
          label="工号"
          rules={[
            { required: true, message: '请输入工号' },
            { max: 32, message: '工号不能超过 32 个字符' },
            { pattern: /^[A-Za-z0-9_-]+$/, message: '只能使用字母、数字、下划线和连字符' },
          ]}
        >
          <Input placeholder="例如 DEMO-1005" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="name"
          label="姓名"
          rules={[
            { required: true, message: '请输入姓名' },
            { max: 50, message: '姓名不能超过 50 个字符' },
          ]}
        >
          <Input placeholder="请输入姓名" autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="organizationId"
          label="所属部门"
          rules={[{ required: true, message: '请选择所属部门' }]}
        >
          <Select
            placeholder="请选择部门"
            options={organizations.map((organization) => ({
              value: organization.id,
              label: organization.name,
            }))}
            showSearch
            optionFilterProp="label"
          />
        </Form.Item>
        <Form.Item
          name="employmentStatus"
          label="任职状态"
          rules={[{ required: true, message: '请选择任职状态' }]}
        >
          <Select
            options={Object.entries(employmentStatusLabels).map(([value, label]) => ({ value, label }))}
          />
        </Form.Item>
        <Form.Item
          name="mobile"
          label="手机号"
          required={!editingMaskedEmployee}
          rules={[
            ...(editingMaskedEmployee ? [] : [{ required: true, message: '请输入手机号' }]),
            { pattern: /^1\d{10}$/, message: '请输入 11 位中国大陆手机号' },
          ]}
          extra={editingMaskedEmployee ? '留空则保持原手机号' : undefined}
        >
          <Input placeholder={editingMaskedEmployee ? '留空则不修改' : '请输入 11 位手机号'} inputMode="numeric" maxLength={11} autoComplete="off" />
        </Form.Item>
        <Form.Item
          name="idCardNo"
          label="身份证号"
          required={!editingMaskedEmployee}
          rules={[
            ...(editingMaskedEmployee ? [] : [{ required: true, message: '请输入身份证号' }]),
            { pattern: /^\d{17}[\dXx]$/, message: '请输入 18 位身份证号' },
          ]}
          extra={editingMaskedEmployee ? '留空则保持原身份证号' : undefined}
        >
          <Input placeholder={editingMaskedEmployee ? '留空则不修改' : '请输入 18 位身份证号'} maxLength={18} autoComplete="off" />
        </Form.Item>
      </div>
    </Form>
  );
}
