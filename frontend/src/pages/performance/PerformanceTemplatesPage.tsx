import { CopyOutlined, DeleteOutlined, FileMarkdownOutlined, PlusOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Modal, Skeleton, Table, Tag, message, type TableColumnsType } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArchivePerformanceTemplate, useCopyPerformanceTemplate, usePerformanceTemplates } from '../../features/performance/api';
import type { PerformanceTemplateListItem } from '@hr-demo/shared';

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false });
}

export function PerformanceTemplatesPage() {
  const navigate = useNavigate();
  const templates = usePerformanceTemplates();
  const copyTemplate = useCopyPerformanceTemplate();
  const archiveTemplate = useArchivePerformanceTemplate();
  const [messageApi, contextHolder] = message.useMessage();
  const [archiveTarget, setArchiveTarget] = useState<PerformanceTemplateListItem | null>(null);
  const copy = async (template: PerformanceTemplateListItem) => {
    try {
      const copied = await copyTemplate.mutateAsync(template.id);
      messageApi.success(`已创建“${copied.name}”，请完成确认后发布`);
      navigate(`/performance/templates/${copied.id}`);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '复制绩效模板失败');
    }
  };
  const archive = async () => {
    if (!archiveTarget) return;
    try {
      await archiveTemplate.mutateAsync({ id: archiveTarget.id, input: { reason: '用户从绩效模板列表归档' } });
      messageApi.success('绩效模板已归档');
      setArchiveTarget(null);
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '归档绩效模板失败');
    }
  };
  const columns: TableColumnsType<PerformanceTemplateListItem> = [
    { title: '模板名称', dataIndex: 'name', key: 'name', width: 260 },
    { title: '绩效模块', dataIndex: 'moduleCount', key: 'moduleCount', width: 120 },
    { title: '解析来源', key: 'source', width: 220, render: (_, record) => <span className="performance-template-source-cell"><FileMarkdownOutlined /> {record.latestVersion?.sourceName ?? '--'}</span> },
    { title: '模板状态', key: 'status', width: 120, render: (_, record) => <Tag color={record.latestVersion?.status === 'PUBLISHED' ? 'green' : 'gold'}>{record.latestVersion?.status === 'PUBLISHED' ? '已发布' : '待配置'}</Tag> },
    { title: '更新时间', key: 'updatedAt', width: 180, render: (_, record) => formatDate(record.updatedAt) },
    { title: '操作', key: 'actions', width: 280, render: (_, record) => <><Button type="link" onClick={() => navigate(`/performance/templates/${record.id}`)}>配置模板</Button><Button type="link" icon={<CopyOutlined />} loading={copyTemplate.isPending && copyTemplate.variables === record.id} onClick={() => void copy(record)}>复制</Button><Button danger type="link" icon={<DeleteOutlined />} loading={archiveTemplate.isPending && archiveTemplate.variables?.id === record.id} onClick={() => setArchiveTarget(record)}>删除</Button></> },
  ];

  return (
    <section className="performance-list-page" aria-labelledby="performance-templates-title">
      {contextHolder}
      <header className="performance-page-heading">
        <div><span>模板配置</span><h1 id="performance-templates-title">绩效模板</h1></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/performance/templates/hrbp-performance-v3')}>配置员工绩效模板</Button>
      </header>
      <Modal
        title="删除绩效模板"
        open={Boolean(archiveTarget)}
        onCancel={() => setArchiveTarget(null)}
        destroyOnHidden
        okText="归档删除"
        okButtonProps={{ danger: true, loading: archiveTemplate.isPending }}
        cancelText="取消"
        onOk={() => void archive()}
      >
        <p>“{archiveTarget?.name}”将被归档，不会删除历史版本、绩效活动或结果。</p>
      </Modal>
      {templates.isError ? <Alert type="error" showIcon message="无法加载绩效模板" description={templates.error.message} /> : null}
      <div className="performance-table-surface">
        {templates.isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : <Table<PerformanceTemplateListItem> className="performance-table" rowKey="id" columns={columns} dataSource={templates.data ?? []} pagination={false} locale={{ emptyText: <Empty description="暂无绩效模板" /> }} />}
      </div>
    </section>
  );
}
