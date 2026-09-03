import { EditOutlined, HistoryOutlined } from '@ant-design/icons';
import { Alert, Button, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Skeleton, Table, Typography, message, type TableColumnsType } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useState } from 'react';
import { usePerformanceAmountBase, usePerformanceAmountBaseHistory, useUpdatePerformanceAmountBase } from '../../features/performance/api';
import type { PerformanceAmountBase } from '@hr-demo/shared';

type AmountBaseHistoryRow = PerformanceAmountBase;

interface AmountBaseFormValues {
  amount: number;
  effectiveAt: Dayjs;
  reason: string;
}

const columns: TableColumnsType<AmountBaseHistoryRow> = [
  { title: '金额基数', dataIndex: 'amount', key: 'amount', width: 180, render: (value: number) => `¥${value.toLocaleString('zh-CN')}` },
  { title: '生效时间', dataIndex: 'effectiveAt', key: 'effectiveAt', width: 180 },
  { title: '版本', dataIndex: 'versionNo', key: 'versionNo', width: 90 },
  { title: '修改时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: '修改人', dataIndex: 'changedByName', key: 'changedByName', width: 150 },
  { title: '修改原因', dataIndex: 'changeReason', key: 'changeReason', width: 220 },
];

export function PerformanceAmountBasePage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const amountBaseQuery = usePerformanceAmountBase();
  const historyQuery = usePerformanceAmountBaseHistory();
  const updateAmountBase = useUpdatePerformanceAmountBase();
  const [form] = Form.useForm<AmountBaseFormValues>();

  const openEditor = () => {
    form.setFieldsValue({ amount: amountBaseQuery.data?.amount ?? 0, effectiveAt: dayjs(), reason: undefined });
    setDrawerOpen(true);
  };

  const saveAmountBase = async (values: AmountBaseFormValues) => {
    try {
      await updateAmountBase.mutateAsync({ amount: values.amount, effectiveAt: values.effectiveAt.toISOString(), reason: values.reason });
      setDrawerOpen(false);
      messageApi.success('金额基数已更新');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '金额基数更新失败');
    }
  };

  const amountBase = amountBaseQuery.data?.amount ?? 0;
  const history = historyQuery.data ?? [];

  return (
    <section className="performance-amount-base-page" aria-labelledby="performance-amount-base-title">
      {contextHolder}
      {amountBaseQuery.isError || historyQuery.isError ? <Alert type="error" showIcon message="无法加载金额基数" description={(amountBaseQuery.error ?? historyQuery.error)?.message} /> : null}
      {(amountBaseQuery.isLoading || historyQuery.isLoading) ? <Skeleton active paragraph={{ rows: 2 }} /> : null}
      <header className="performance-page-heading">
        <div>
          <span>全局配置</span>
          <h1 id="performance-amount-base-title">金额基数</h1>
        </div>
        <Button type="primary" icon={<EditOutlined />} onClick={openEditor}>修改金额基数</Button>
      </header>

      <div className="performance-amount-summary">
        <div>
          <span>当前金额基数</span>
          <strong>{amountBase > 0 ? `¥${amountBase.toLocaleString('zh-CN')}` : '--'}</strong>
        </div>
        <Descriptions column={{ xs: 1, sm: 2 }} size="small">
          <Descriptions.Item label="适用范围">全部人员</Descriptions.Item>
          <Descriptions.Item label="实际审批金额">最终得分 / 100 × 金额基数</Descriptions.Item>
        </Descriptions>
      </div>

      <section className="performance-table-surface performance-history-surface" aria-labelledby="amount-history-title">
        <header className="performance-section-heading">
          <h2 id="amount-history-title"><HistoryOutlined /> 变更记录</h2>
        </header>
        <Table<AmountBaseHistoryRow>
          className="performance-table"
          columns={columns}
          dataSource={history}
          pagination={false}
          locale={{ emptyText: <Typography.Text type="secondary">暂无金额基数变更记录</Typography.Text> }}
        />
      </section>

      <Drawer
        title="修改金额基数"
        width={420}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        destroyOnHidden
        extra={<Button type="primary" onClick={() => form.submit()}>保存</Button>}
      >
        <Form<AmountBaseFormValues> form={form} layout="vertical" onFinish={saveAmountBase}>
          <Form.Item name="amount" label="金额基数" rules={[{ required: true, message: '请输入金额基数' }, { type: 'number', min: 0, message: '金额基数不能小于 0' }]}>
            <InputNumber min={0} precision={2} prefix="¥" style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="effectiveAt" label="生效时间" rules={[{ required: true, message: '请选择生效时间' }]}>
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="reason" label="修改原因" rules={[{ required: true, whitespace: true, message: '请输入修改原因' }]}>
            <Input.TextArea rows={4} maxLength={10000} />
          </Form.Item>
        </Form>
      </Drawer>
    </section>
  );
}
