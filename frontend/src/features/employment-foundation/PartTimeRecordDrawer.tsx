import type { EmployeeDirectoryOption, EmployeeFormOption, EmployeeManagerOption, PartTimeRecordItem, CreatePartTimeRecordInput } from '@hr-demo/shared';
import { Alert, Button, Descriptions, Drawer, Form, Input, Select, Space, Spin } from 'antd';
import { useState } from 'react';
import { useActivatePartTimeRecord, useCreatePartTimeRecord, useEndPartTimeRecord, usePartTimeRecord } from './api';

export interface PartTimeRecordDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  recordId?: string;
  employee: { id: string; employeeNo: string; name: string | null };
  organizations: EmployeeFormOption[];
  jobTitles?: EmployeeDirectoryOption[];
  managers?: EmployeeManagerOption[];
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : '操作失败';
}

export function PartTimeRecordDrawer({ open, onClose, onSuccess, recordId, employee, organizations, jobTitles = [], managers = [] }: PartTimeRecordDrawerProps) {
  const create = useCreatePartTimeRecord();
  const activate = useActivatePartTimeRecord();
  const end = useEndPartTimeRecord();
  const query = usePartTimeRecord(recordId || '', open && Boolean(recordId));
  const [type, setType] = useState('');
  const [institution, setInstitution] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [jobTitleId, setJobTitleId] = useState('');
  const [managerEmployeeId, setManagerEmployeeId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');
  const detail = query.data as PartTimeRecordItem | undefined;
  const isDetail = Boolean(recordId);

  const save = async () => {
    setError('');
    if (!type || !organizationId || !startDate) { setError('请填写兼职类型、兼职组织和开始日期'); return; }
    if (endDate && endDate < startDate) { setError('结束日期不能早于开始日期'); return; }
    const input: CreatePartTimeRecordInput = {
      employeeId: employee.id, type, organizationId, startDate,
      ...(institution ? { institution } : {}), ...(jobTitleId ? { jobTitleId } : {}), ...(managerEmployeeId ? { managerEmployeeId } : {}),
      ...(endDate ? { endDate } : {}),
    };
    try { await create.mutateAsync(input); onSuccess?.(); onClose(); } catch (cause) { setError(errorText(cause)); }
  };
  const activateRecord = async () => { try { await activate.mutateAsync(recordId!); onSuccess?.(); } catch (cause) { setError(errorText(cause)); } };
  const endRecord = async () => {
    if (!endDate || (detail && endDate < detail.startDate)) { setError(detail ? '结束日期不能早于开始日期' : '请选择结束日期'); return; }
    try { await end.mutateAsync({ id: recordId!, input: { endDate } }); onSuccess?.(); } catch (cause) { setError(errorText(cause)); }
  };

  return (
    <Drawer title={isDetail ? '兼职记录详情' : '新增兼职记录'} open={open} onClose={onClose} width={520} destroyOnClose={false}>
      {isDetail ? query.isLoading ? <Spin /> : detail ? <Space direction="vertical" style={{ width: '100%' }}>
        <Descriptions column={1} bordered>
          <Descriptions.Item label="员工">{detail.employee.name || '--'}（{detail.employee.employeeNo}）</Descriptions.Item>
          <Descriptions.Item label="兼职类型">{detail.type}</Descriptions.Item>
          <Descriptions.Item label="兼职组织">{detail.organization.name}</Descriptions.Item>
          <Descriptions.Item label="开始日期">{detail.startDate}</Descriptions.Item>
          <Descriptions.Item label="结束日期">{detail.endDate || '--'}</Descriptions.Item>
          <Descriptions.Item label="状态">{detail.status}</Descriptions.Item>
        </Descriptions>
        {error ? <Alert type="error" message={error} /> : null}
        <Input aria-label="结束日期" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        <Space>{detail.canActivate ? <Button aria-label="生效" type="primary" onClick={() => void activateRecord()}>生效</Button> : null}{detail.canEnd ? <Button aria-label="结束兼职" danger onClick={() => void endRecord()}>结束兼职</Button> : null}</Space>
      </Space> : <Alert type="error" message={errorText(query.error)} /> : <Form layout="vertical">
        <Form.Item label="员工"><span>{employee.name || '--'}（{employee.employeeNo}）</span></Form.Item>
        <Form.Item label="兼职类型" required><Input aria-label="兼职类型" value={type} onChange={(event) => setType(event.target.value)} /></Form.Item>
        <Form.Item label="兼职机构"><Input aria-label="兼职机构" value={institution} onChange={(event) => setInstitution(event.target.value)} /></Form.Item>
        <Form.Item label="兼职组织" required><Select aria-label="兼职组织" value={organizationId || undefined} onChange={setOrganizationId} options={organizations.map((option) => ({ value: option.id, label: option.name }))} /></Form.Item>
        {jobTitles.length ? <Form.Item label="兼职职务"><Select aria-label="兼职职务" allowClear value={jobTitleId || undefined} onChange={(value) => setJobTitleId(value || '')} options={jobTitles.map((option) => ({ value: option.id, label: option.name }))} /></Form.Item> : null}
        {managers.length ? <Form.Item label="兼职直线经理"><Select aria-label="兼职直线经理" allowClear value={managerEmployeeId || undefined} onChange={(value) => setManagerEmployeeId(value || '')} options={managers.map((option) => ({ value: option.id, label: `${option.name}（${option.employeeNo}）` }))} /></Form.Item> : null}
        <Form.Item label="开始日期" required><Input aria-label="开始日期" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Form.Item>
        <Form.Item label="结束日期"><Input aria-label="结束日期" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Form.Item>
        {error ? <Alert type="error" message={error} /> : null}
        <Space><Button onClick={onClose}>取消</Button><Button type="primary" loading={create.isPending} onClick={() => void save()}>保存</Button></Space>
      </Form>}
    </Drawer>
  );
}
