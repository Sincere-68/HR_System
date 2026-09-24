import type {
  CreateEmploymentConversionInput,
  EmployeeDirectoryOption,
  EmployeeFormOption,
  EmploymentConversionType,
  JobLevel,
} from '@hr-demo/shared';
import { Alert, Button, Drawer, Form, Input, Select, Space } from 'antd';
import { useState } from 'react';
import { useCreateEmploymentConversion } from './api';

export interface ConversionRequestDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  employee: { id: string; employeeNo: string; name: string | null };
  sourceEmploymentPeriodId: string;
  type: EmploymentConversionType;
  organizations: EmployeeFormOption[];
  positions?: EmployeeFormOption[];
  jobTitles?: EmployeeDirectoryOption[];
  jobLevels?: Array<{ value: JobLevel; label: string }>;
}

function getError(error: unknown) {
  const candidate = error as { status?: number; message?: string };
  return {
    status: candidate?.status,
    message: candidate?.message || '提交失败',
  };
}

export function ConversionRequestDrawer({
  open,
  onClose,
  onSuccess,
  employee,
  sourceEmploymentPeriodId,
  type,
  organizations,
  positions = [],
  jobTitles = [],
  jobLevels = [],
}: ConversionRequestDrawerProps) {
  const create = useCreateEmploymentConversion();
  const [targetOrganizationId, setTargetOrganizationId] = useState('');
  const [targetPositionId, setTargetPositionId] = useState('');
  const [targetJobTitleId, setTargetJobTitleId] = useState('');
  const [targetJobLevel, setTargetJobLevel] = useState<JobLevel>();
  const [plannedEffectiveDate, setPlannedEffectiveDate] = useState('');
  const [validation, setValidation] = useState<{ organization?: string; date?: string }>({});
  const [error, setError] = useState('');

  const submit = async () => {
    const nextValidation = {
      organization: targetOrganizationId ? undefined : '请选择目标组织',
      date: plannedEffectiveDate ? undefined : '请选择计划生效日期',
    };
    setValidation(nextValidation);
    if (nextValidation.organization || nextValidation.date) return;
    setError('');
    const input: CreateEmploymentConversionInput = {
      type,
      employeeId: employee.id,
      sourceEmploymentPeriodId,
      targetOrganizationId,
      ...(targetPositionId ? { targetPositionId } : {}),
      ...(targetJobTitleId ? { targetJobTitleId } : {}),
      ...(targetJobLevel ? { targetJobLevel } : {}),
      plannedEffectiveDate,
    };
    try {
      await create.mutateAsync(input);
      onSuccess?.();
      onClose();
    } catch (cause) {
      const result = getError(cause);
      setError(result.status === 422 ? '请先发布对应业务审批流程' : result.message);
    }
  };

  return (
    <Drawer title="提交转换申请" open={open} onClose={onClose} width={520} destroyOnClose={false}>
      <Form layout="vertical">
        <Form.Item label="员工"><span>{employee.name || '--'}（{employee.employeeNo}）</span></Form.Item>
        <Form.Item label="目标组织" required validateStatus={validation.organization ? 'error' : undefined} help={validation.organization}>
          <Select aria-label="目标组织" placeholder="请选择目标组织" value={targetOrganizationId || undefined} onChange={setTargetOrganizationId} options={organizations.map((option) => ({ value: option.id, label: option.name }))} />
        </Form.Item>
        {positions.length ? <Form.Item label="目标岗位"><Select aria-label="目标岗位" allowClear value={targetPositionId || undefined} onChange={(value) => setTargetPositionId(value || '')} options={positions.map((option) => ({ value: option.id, label: option.name }))} /></Form.Item> : null}
        {jobTitles.length ? <Form.Item label="目标职务"><Select aria-label="目标职务" allowClear value={targetJobTitleId || undefined} onChange={(value) => setTargetJobTitleId(value || '')} options={jobTitles.map((option) => ({ value: option.id, label: option.name }))} /></Form.Item> : null}
        {jobLevels.length ? <Form.Item label="目标职级"><Select aria-label="目标职级" allowClear value={targetJobLevel} onChange={setTargetJobLevel} options={jobLevels} /></Form.Item> : null}
        <Form.Item label="计划生效日期" required validateStatus={validation.date ? 'error' : undefined} help={validation.date}>
          <Input aria-label="计划生效日期" type="date" value={plannedEffectiveDate} onChange={(event) => setPlannedEffectiveDate(event.target.value)} />
        </Form.Item>
        {error ? <Alert type="error" message={error} /> : null}
        <Space>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" loading={create.isPending} onClick={() => void submit()}>提交申请</Button>
        </Space>
      </Form>
    </Drawer>
  );
}
