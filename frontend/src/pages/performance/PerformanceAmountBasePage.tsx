import { EditOutlined, HistoryOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Drawer, Form, Input, InputNumber, Skeleton, Space, Table, Tag, Typography, message, type TableColumnsType } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { useCreateEmployeePerformanceAmountBase, useEmployeePerformanceAmountBaseHistory, useEmployeePerformanceAmountBases } from '../../features/performance/api';
import type { EmployeePerformanceAmountBase } from '@hr-demo/shared';

interface AmountBaseFormValues {
  amount: number;
  effectiveAt: Dayjs;
  reason: string;
}

const columns: TableColumnsType<EmployeePerformanceAmountBase> = [
  { title: '姓名', key: 'employee', width: 160, render: (_, row) => `${row.employeeName}（${row.employeeNo}）` },
  { title: '部门', dataIndex: 'organizationName', key: 'organizationName', width: 180, render: (value) => value ?? '--' },
  { title: '个人金额基数', dataIndex: 'amount', key: 'amount', width: 150, render: (value: number) => `¥${value.toLocaleString('zh-CN')}` },
  { title: '版本', dataIndex: 'versionNo', key: 'versionNo', width: 80 },
  { title: '生效时间', dataIndex: 'effectiveAt', key: 'effectiveAt', width: 180, render: (value) => value ?? '--' },
  { title: '设置人', dataIndex: 'changedByName', key: 'changedByName', width: 130, render: (value) => value ?? '--' },
  { title: '修改原因', dataIndex: 'changeReason', key: 'changeReason', width: 220, render: (value) => value ?? '--' },
];

export function PerformanceAmountBasePage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [keyword, setKeyword] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeePerformanceAmountBase | null>(null);
  const [pendingEmployeeId, setPendingEmployeeId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form] = Form.useForm<AmountBaseFormValues>();
  const amountBases = useEmployeePerformanceAmountBases({ keyword, page: 1, pageSize: 100 });
  const history = useEmployeePerformanceAmountBaseHistory(selectedEmployee?.employeeId ?? '');
  const createAmountBase = useCreateEmployeePerformanceAmountBase();

  const openEditor = (employee: EmployeePerformanceAmountBase) => {
    setSelectedEmployee(employee);
    setPendingEmployeeId(employee.employeeId);
    form.setFieldsValue({ amount: employee.versionNo ? employee.amount : 0, effectiveAt: dayjs(), reason: undefined });
    setDrawerOpen(true);
  };

  const saveAmountBase = async (values: AmountBaseFormValues) => {
    if (!pendingEmployeeId) return;
    try {
      await createAmountBase.mutateAsync({ employeeId: pendingEmployeeId, amount: values.amount, effectiveAt: values.effectiveAt.toISOString(), reason: values.reason });
      setDrawerOpen(false);
      messageApi.success('员工个人绩效金额基数已保存为新版本');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '员工个人绩效金额基数保存失败');
    }
  };

  return (
    <section className="performance-amount-base-page" aria-labelledby="performance-amount-base-title">
      {contextHolder}
      {amountBases.isError ? <Alert type="error" showIcon message="无法加载员工绩效金额基数" description={amountBases.error.message} /> : null}
      <header className="performance-page-heading">
        <div><span>绩效系统设置</span><h1 id="performance-amount-base-title">员工绩效金额基数</h1></div>
      </header>
      <div className="performance-amount-summary">
        <div><span>计算口径</span><strong>最终得分 ÷ 100 × 个人金额基数</strong></div>
        <Typography.Text type="secondary">每位员工单独维护。结果保存时冻结该员工最新个人基数快照，后续基数变更不会重算历史金额。</Typography.Text>
      </div>
      <section className="performance-table-surface performance-history-surface" aria-labelledby="employee-amount-base-list-title">
        <header className="performance-section-heading">
          <h2 id="employee-amount-base-list-title"><HistoryOutlined /> 当前个人基数</h2>
          <Input allowClear value={keyword} onChange={(event) => setKeyword(event.target.value)} prefix={<SearchOutlined />} placeholder="搜索姓名或工号" style={{ width: 240 }} />
        </header>
        <Typography.Text type="secondary">先在搜索框中定位员工；尚未配置基数的员工显示“新增基数”，首次保存后会成为该员工的第一版基数。</Typography.Text>
        {amountBases.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : <Table<EmployeePerformanceAmountBase> className="performance-table" rowKey="id" columns={[...columns, { title: '操作', key: 'actions', width: 140, render: (_, row) => <Button type="link" icon={<EditOutlined />} onClick={() => openEditor(row)}>新增版本</Button> }]} dataSource={amountBases.data?.data ?? []} pagination={false} locale={{ emptyText: <Typography.Text type="secondary">暂无已配置个人金额基数的员工</Typography.Text> }} />}
      </section>
      {selectedEmployee ? <section className="performance-table-surface performance-history-surface" aria-labelledby="employee-amount-base-history-title">
        <header className="performance-section-heading"><h2 id="employee-amount-base-history-title">{selectedEmployee.employeeName} 的版本历史</h2></header>
        {history.isLoading ? <Skeleton active paragraph={{ rows: 2 }} /> : <Table<EmployeePerformanceAmountBase> className="performance-table" rowKey="id" columns={columns.slice(2, -1)} dataSource={history.data ?? []} pagination={false} />}
      </section> : null}
      <Drawer title={`新增${selectedEmployee?.employeeName ?? ''}的个人金额基数版本`} width={420} open={drawerOpen} onClose={() => setDrawerOpen(false)} destroyOnHidden extra={<Button type="primary" loading={createAmountBase.isPending} onClick={() => form.submit()}>保存</Button>}>
        <Form<AmountBaseFormValues> form={form} layout="vertical" onFinish={saveAmountBase}>
          <Form.Item name="amount" label="个人绩效金额基数" rules={[{ required: true, message: '请输入个人绩效金额基数' }, { type: 'number', min: 0, message: '金额基数不能小于 0' }]}><InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="effectiveAt" label="生效时间" rules={[{ required: true, message: '请选择生效时间' }]}><DatePicker showTime style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="reason" label="修改原因" rules={[{ required: true, whitespace: true, message: '请输入修改原因' }]}><Input.TextArea rows={4} maxLength={10000} /></Form.Item>
        </Form>
      </Drawer>
    </section>
  );
}
