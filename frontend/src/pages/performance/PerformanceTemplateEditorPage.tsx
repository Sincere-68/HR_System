import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CheckCircleFilled,
  DownOutlined,
  FileMarkdownOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SaveOutlined,
  SwapOutlined,
  HolderOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Checkbox,
  Input,
  InputNumber,
  Select,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  Tooltip,
  Upload,
  message,
  type TableColumnsType,
  type UploadProps,
} from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { performanceApi, useCreatePerformanceTemplate, useCreatePerformanceTemplateVersion, usePerformanceOptions, usePerformanceTemplate } from '../../features/performance/api';
import {
  getFixedWeightTotal,
  parsedHrbpPerformanceTemplate,
  reorderPerformanceModules,
  type PerformanceIndicator,
  type PerformanceModuleKind,
  type PerformanceTemplateModule,
} from '../../features/performance/hrbp-template';

const workflowSteps = ['基本信息', '流程设置', '考核表设置', '下发指标', '权限设置'];

const moduleTypeLabels: Record<PerformanceModuleKind, string> = {
  metric: '指标计算',
  evaluation: '人工评估',
  adjustment: '结果调整',
};

const permissionRows = [
  { key: 'hr-admin', role: 'HR 管理员', scope: '导入 Markdown、编辑模板、保存模板、下发指标' },
  { key: 'module-owner', role: '模块负责人', scope: '处理当前模块并查看前序模块已提交信息' },
  { key: 'approver', role: '审批人', scope: '查看最终得分、金额基数快照和审批金额' },
];

function ModuleTypeTag({ type }: { type: PerformanceModuleKind }) {
  return <Tag className={`performance-module-kind is-${type}`}>{moduleTypeLabels[type]}</Tag>;
}

export function PerformanceTemplateEditorPage() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const existingTemplate = usePerformanceTemplate(templateId && templateId !== 'new' ? templateId : '');
  const options = usePerformanceOptions(true);
  const createTemplate = useCreatePerformanceTemplate();
  const createTemplateVersion = useCreatePerformanceTemplateVersion();
  const [messageApi, contextHolder] = message.useMessage();
  const [activeStep, setActiveStep] = useState(0);
  const [templateName, setTemplateName] = useState(parsedHrbpPerformanceTemplate.name);
  const [sourceMarkdown, setSourceMarkdown] = useState(parsedHrbpPerformanceTemplate.sourceMarkdown);
  const [modules, setModules] = useState<PerformanceTemplateModule[]>(parsedHrbpPerformanceTemplate.modules);
  const [selectedModuleId, setSelectedModuleId] = useState(parsedHrbpPerformanceTemplate.modules[0]?.id ?? '');
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
  const [sourceName, setSourceName] = useState(parsedHrbpPerformanceTemplate.sourceName);
  const [initializedTemplateId, setInitializedTemplateId] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);

  useEffect(() => {
    const version = existingTemplate.data?.versions[0];
    if (!version || initializedTemplateId === templateId) return;
    setTemplateName(version.definition.name);
    setSourceMarkdown(version.sourceMarkdown);
    setSourceName(version.sourceName ?? parsedHrbpPerformanceTemplate.sourceName);
    setModules(version.definition.modules.map((module) => ({
      ...module,
      type: module.type.toLowerCase() as PerformanceModuleKind,
      responsibleRole: module.name,
      executor: module.executor,
      indicators: module.indicators.map((indicator) => ({ ...indicator, weightLabel: `${indicator.weight}%`, source: version.sourceName ?? '模板定义' })),
    })));
    setSelectedModuleId(version.definition.modules[0]?.id ?? '');
    setInitializedTemplateId(templateId ?? null);
  }, [existingTemplate.data, initializedTemplateId, templateId]);

  const selectedModule = modules.find((module) => module.id === selectedModuleId) ?? modules[0];
  const fixedWeightTotal = useMemo(() => getFixedWeightTotal(modules), [modules]);
  const isWeightValid = fixedWeightTotal === 100;

  const updateModule = (moduleId: string, change: Partial<PerformanceTemplateModule>) => {
    setModules((current) => current.map((module) => (module.id === moduleId ? { ...module, ...change } : module)));
  };

  const moveModule = (moduleId: string, direction: -1 | 1) => {
    setModules((current) => {
      const currentIndex = current.findIndex((module) => module.id === moduleId);
      const targetIndex = currentIndex + direction;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const next = [...current];
      const currentModule = next[currentIndex];
      const targetModule = next[targetIndex];
      if (!currentModule || !targetModule) return current;
      next[currentIndex] = targetModule;
      next[targetIndex] = currentModule;
      return next;
    });
  };

  const dropModule = (targetModuleId: string) => {
    if (!draggedModuleId) return;
    setModules((current) => reorderPerformanceModules(current, draggedModuleId, targetModuleId));
    setDraggedModuleId(null);
    setDragOverModuleId(null);
  };

  const applyMarkdown = async (markdown: string, importedSourceName = sourceName) => {
    setSourceMarkdown(markdown);
    setSourceName(importedSourceName);
    setIsParsing(true);
    try {
      const parsed = await performanceApi.parseTemplate(markdown, importedSourceName);
      if (!parsed.definition || parsed.errors.length) {
        setParseWarnings(parsed.errors.map((item) => item.message));
        messageApi.error(parsed.errors.map((item) => item.message).join('；') || 'Markdown 解析失败');
        return;
      }
      setTemplateName(parsed.definition.name);
      const nextModules = parsed.definition.modules.map((module) => ({
        ...module,
        type: module.type.toLowerCase() as PerformanceModuleKind,
        responsibleRole: module.executor.type === 'AUTO' ? '系统自动计算' : '待指定执行人',
        indicators: module.indicators.map((indicator) => ({ ...indicator, weightLabel: `${indicator.weight}%`, source: importedSourceName })),
      }));
      setModules(nextModules);
      setSelectedModuleId(nextModules[0]?.id ?? '');
      setParseWarnings(parsed.warnings.map((item) => item.message));
      messageApi.success('Markdown 已由后端解析为可确认的模板结构');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : 'Markdown 解析失败');
    } finally {
      setIsParsing(false);
    }
  };

  const importMarkdown: UploadProps['beforeUpload'] = (file) => {
    if (!file.name.toLowerCase().endsWith('.md')) {
      messageApi.error('请选择 Markdown 文件');
      return Upload.LIST_IGNORE;
    }
    const reader = new FileReader();
    reader.onload = () => void applyMarkdown(String(reader.result ?? ''), file.name);
    reader.readAsText(file);
    return false;
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      setActiveStep(0);
      messageApi.error('请输入模板名称');
      return;
    }
    if (!isWeightValid) {
      setActiveStep(2);
      messageApi.error(`固定权重模块合计为 ${fixedWeightTotal}%，必须等于 100% 后才能保存模板`);
      return;
    }
    const definition = {
      schemaVersion: 1 as const,
      name: templateName.trim(),
      description: '依据模板 Markdown 解析的绩效流程定义。',
      modules: modules.map((module) => ({
        id: module.id,
        name: module.name,
        type: module.type.toUpperCase() as 'METRIC' | 'EVALUATION' | 'ADJUSTMENT',
        enabled: module.enabled,
        participatesInTotal: module.participatesInTotal,
        weight: module.weight,
        description: module.description,
        executor: module.executor,
        indicators: module.indicators.map((indicator) => ({ ...indicator, weight: indicator.weight ?? (Number(indicator.weightLabel.replace('%', '')) || 0) })),
        adjustmentDirection: module.adjustmentDirection,
        adjustmentMin: module.adjustmentMin,
        adjustmentMax: module.adjustmentMax,
        requireComment: module.requireComment,
        requireAttachment: module.requireAttachment,
      })),
    };
    try {
      const input = { name: templateName.trim(), sourceName, sourceMarkdown, definition };
      if (templateId && templateId !== 'new' && templateId !== 'hrbp-performance-v3') {
        await createTemplateVersion.mutateAsync({ id: templateId, input });
      } else {
        await createTemplate.mutateAsync(input);
      }
      messageApi.success('模板已保存');
      navigate('/performance/templates');
    } catch (error) {
      messageApi.error(error instanceof Error ? error.message : '模板保存失败');
    }
  };

  const indicatorColumns: TableColumnsType<PerformanceIndicator> = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 150 },
    { title: '指标描述', dataIndex: 'description', key: 'description', width: 210 },
    {
      title: '衡量标准',
      dataIndex: 'standards',
      key: 'standards',
      render: (standards: string[]) => (
        <ul className="performance-indicator-standards">
          {standards.map((standard) => <li key={standard}>{standard}</li>)}
        </ul>
      ),
    },
    { title: '指标权重', dataIndex: 'weightLabel', key: 'weightLabel', width: 120 },
  ];

  const renderModuleList = (variant: 'flow' | 'assessment' | 'dispatch') => (
    <aside className={`performance-template-module-list is-${variant}`} aria-label="绩效模块列表">
      <div className="performance-flow-list-heading">
        <strong>{variant === 'flow' ? '处理顺序' : variant === 'assessment' ? '考核表模块' : '已解析模块'}</strong>
        {variant === 'flow' ? <span><SwapOutlined /> 拖动调整顺序</span> : null}
      </div>
      <div className="performance-template-module-scroll">
        {modules.map((module, index) => (
          <button
            className={`performance-template-module-card${selectedModule?.id === module.id ? ' is-selected' : ''}${!module.enabled ? ' is-disabled' : ''}${draggedModuleId === module.id ? ' is-dragging' : ''}${dragOverModuleId === module.id && draggedModuleId !== module.id ? ' is-drop-target' : ''}`}
            key={module.id}
            type="button"
            draggable={variant === 'flow'}
            onClick={() => setSelectedModuleId(module.id)}
            onDragStart={(event) => {
              if (variant !== 'flow') return;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', module.id);
              setDraggedModuleId(module.id);
            }}
            onDragOver={(event) => {
              if (variant !== 'flow' || draggedModuleId === module.id) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverModuleId(module.id);
            }}
            onDragEnd={() => {
              setDraggedModuleId(null);
              setDragOverModuleId(null);
            }}
            onDrop={(event) => {
              if (variant !== 'flow') return;
              event.preventDefault();
              dropModule(module.id);
            }}
          >
            <span className="performance-module-card-head">
              {variant === 'flow' ? <b>{index + 1}</b> : null}
              <strong>{module.name}</strong>
              {variant === 'flow' ? <span className="performance-module-drag-handle" aria-label="拖动调整模块顺序"><HolderOutlined /></span> : null}
            </span>
            <span className="performance-module-card-meta">
              <ModuleTypeTag type={module.type} />
              {module.participatesInTotal ? <span>权重 {module.weight ?? 0}%</span> : <span>额外调整</span>}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );

  const renderBasicInformation = () => (
    <section className="performance-template-step-content" aria-labelledby="template-basic-title">
      <div className="performance-template-section-heading">
        <div>
          <span>模板来源</span>
          <h2 id="template-basic-title">基本信息</h2>
        </div>
      </div>
      <div className="performance-template-form-surface">
        <label className="performance-template-field">
          <span><i>*</i> 模板名称</span>
          <Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
        </label>
        <label className="performance-template-field">
          <span>模板说明</span>
          <Input.TextArea value="由当前导入 Markdown 的实际模块、指标、衡量标准和评分参考组成；待确认项会在解析预览中提示。" autoSize={{ minRows: 3, maxRows: 3 }} readOnly />
        </label>
        <div className="performance-template-source-card">
          <div>
            <span className="performance-template-source-icon" aria-hidden="true"><FileMarkdownOutlined /></span>
            <div>
              <strong>已解析 Markdown 来源</strong>
              <p>{sourceName}</p>
            </div>
          </div>
          <Upload accept=".md,text/markdown" showUploadList={false} beforeUpload={importMarkdown}>
            <Button icon={<UploadOutlined />}>导入并解析</Button>
          </Upload>
        </div>
        <label className="performance-template-field is-source-text">
          <span>Markdown 解析内容</span>
          <Input.TextArea value={sourceMarkdown} onChange={(event) => setSourceMarkdown(event.target.value)} autoSize={{ minRows: 12, maxRows: 18 }} />
        </label>
        {parseWarnings.length ? <Alert type="warning" showIcon message="Markdown 解析需要确认" description={<ul>{parseWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>} /> : null}
        <Button icon={<ReloadOutlined />} loading={isParsing} onClick={() => void applyMarkdown(sourceMarkdown)}>使用后端重新解析当前内容</Button>
      </div>
    </section>
  );

  const renderFlowSettings = () => (
    <section className="performance-template-step-content" aria-labelledby="template-flow-title">
      <div className="performance-template-section-heading">
        <div>
          <span>模块流转</span>
          <h2 id="template-flow-title">流程设置</h2>
        </div>
        <p>拖动左侧模块可调整顺序。模块按当前顺序严格串行流转，完成当前模块后才会开放下一模块。</p>
      </div>
      <div className="performance-template-workspace">
        {renderModuleList('flow')}
        {selectedModule ? (
          <section className="performance-template-detail" aria-labelledby="selected-flow-module-title">
            <div className="performance-template-detail-title">
              <div>
                <ModuleTypeTag type={selectedModule.type} />
                <h3 id="selected-flow-module-title">{selectedModule.name}</h3>
              </div>
              <Space size={4}>
                <Tooltip title="上移模块"><Button aria-label="上移模块" type="text" icon={<ArrowUpOutlined />} onClick={() => moveModule(selectedModule.id, -1)} /></Tooltip>
                <Tooltip title="下移模块"><Button aria-label="下移模块" type="text" icon={<ArrowDownOutlined />} onClick={() => moveModule(selectedModule.id, 1)} /></Tooltip>
              </Space>
            </div>
            <div className="performance-template-detail-form">
              <label>
                <span>模块类型</span>
                <Input value={moduleTypeLabels[selectedModule.type]} disabled />
              </label>
              <label>
                <span><i>*</i> 执行人来源</span>
                <Select
                  aria-label="执行人来源"
                  value={selectedModule.executor.type}
                  options={selectedModule.type === 'metric' ? [{ label: '系统自动计算', value: 'AUTO' }] : [{ label: '具体执行人', value: 'USER' }, { label: '特定岗位名称', value: 'DIRECTORY' }]}
                  onChange={(type: 'AUTO' | 'USER' | 'DIRECTORY') => updateModule(selectedModule.id, { executor: { type } })}
                />
              </label>
              {selectedModule.type !== 'metric' && selectedModule.executor.type === 'USER' ? (
                <label>
                  <span><i>*</i> 具体执行人</span>
                  <Select
                    aria-label="具体执行人"
                    showSearch
                    options={(options.data?.users ?? []).map((option) => ({ label: `${option.displayName}（${option.username}）`, value: option.id }))}
                    value={selectedModule.executor.userId}
                    onChange={(userId) => updateModule(selectedModule.id, { executor: { type: 'USER', userId } })}
                  />
                </label>
              ) : null}
              {selectedModule.type !== 'metric' && selectedModule.executor.type === 'DIRECTORY' ? (
                <label>
                  <span><i>*</i> 特定岗位名称</span>
                  <Select
                    aria-label="特定岗位名称"
                    showSearch
                    options={[
                      ...(options.data?.positions ?? []).map((option) => ({ label: `职位：${option.name}`, value: `POSITION:${option.id}` })),
                      ...(options.data?.jobTitles ?? []).map((option) => ({ label: `职务：${option.code} - ${option.name}`, value: `JOB_TITLE:${option.id}` })),
                    ]}
                    value={selectedModule.executor.directoryId ? `${selectedModule.executor.directoryType}:${selectedModule.executor.directoryId}` : undefined}
                    onChange={(value: string) => { const [directoryType, directoryId] = value.split(':'); updateModule(selectedModule.id, { executor: { type: 'DIRECTORY', directoryType: directoryType as 'POSITION' | 'JOB_TITLE', directoryId } }); }}
                  />
                </label>
              ) : null}
              <label>
                <span>模块说明</span>
                <Input.TextArea value={selectedModule.description} autoSize={{ minRows: 4, maxRows: 5 }} onChange={(event) => updateModule(selectedModule.id, { description: event.target.value })} />
              </label>
            </div>
            <div className="performance-template-flow-note">
              <InfoCircleOutlined />
              <span>{selectedModule.type === 'metric' ? '指标计算模块会在轮转到此步骤时自动拉取业务数据并计算结果。' : '当前负责人可查看所有已完成的前序模块；已完成模块将锁定为只读。'}</span>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );

  const renderAssessmentSettings = () => (
    <section className="performance-template-step-content" aria-labelledby="template-assessment-title">
      <div className="performance-template-section-heading">
        <div>
          <span>权重与启用状态</span>
          <h2 id="template-assessment-title">考核表设置</h2>
        </div>
        <div className={`performance-weight-total${isWeightValid ? ' is-valid' : ' is-invalid'}`} role="status">
          {isWeightValid ? <CheckCircleFilled /> : <InfoCircleOutlined />}
          <strong>固定模块权重 {fixedWeightTotal}% / 100%</strong>
        </div>
      </div>
      {!isWeightValid ? <Alert className="performance-weight-alert" type="error" showIcon message={`当前固定模块权重合计为 ${fixedWeightTotal}%，保存模板前必须调整为 100%。`} /> : null}
      <div className="performance-template-workspace">
        {renderModuleList('assessment')}
        {selectedModule ? (
          <section className="performance-template-detail" aria-labelledby="selected-assessment-module-title">
            <div className="performance-template-detail-title">
              <div>
                <ModuleTypeTag type={selectedModule.type} />
                <h3 id="selected-assessment-module-title">{selectedModule.name}</h3>
              </div>
              <Switch checked={selectedModule.enabled} checkedChildren="已启用" unCheckedChildren="未启用" onChange={(enabled) => updateModule(selectedModule.id, { enabled })} />
            </div>
            <div className="performance-template-detail-form">
              <label>
                <span>参与总分计算</span>
                <Checkbox checked={selectedModule.participatesInTotal} disabled={selectedModule.type === 'adjustment'} onChange={(event) => updateModule(selectedModule.id, { participatesInTotal: event.target.checked })}>计入固定权重</Checkbox>
              </label>
              {selectedModule.participatesInTotal ? (
                <label>
                  <span><i>*</i> 模块权重</span>
                  <Space.Compact block className="performance-module-weight-input">
                    <InputNumber aria-label="模块权重" value={selectedModule.weight ?? 0} min={0} max={100} precision={2} onChange={(weight) => updateModule(selectedModule.id, { weight: typeof weight === 'number' ? weight : 0 })} />
                    <span className="performance-module-weight-suffix">%</span>
                  </Space.Compact>
                </label>
              ) : (
                <div className="performance-adjustment-explanation">
                  <strong>{selectedModule.type === 'adjustment' ? '额外调整项' : '辅助模块'}</strong>
                  <span>{selectedModule.type === 'adjustment' ? '此模块直接加减月度绩效分，不参与固定权重合计。' : '该模块不计入固定权重合计。'}</span>
                </div>
              )}
              <label>
                <span>评分口径</span>
                <Input value={selectedModule.type === 'adjustment' ? '按事实依据进行额外加减分' : '百分制，模块总分按模块权重参与结果计算'} disabled />
              </label>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );

  const renderDispatchIndicators = () => (
    <section className="performance-template-step-content" aria-labelledby="template-dispatch-title">
      <div className="performance-template-section-heading">
        <div>
          <span>结构化指标</span>
          <h2 id="template-dispatch-title">下发指标</h2>
        </div>
        <p>指标名称、描述、衡量标准和内部权重均来自当前 Markdown 解析结果。</p>
      </div>
      <Alert className="performance-indicator-alert" type="info" showIcon message="指标描述、衡量标准和评分参考来自实际 Markdown。业务模块必须另行确认数据字段和声明式评分规则；人工模块由处理人提交模块总分。" />
      <div className="performance-template-workspace">
        {renderModuleList('dispatch')}
        {selectedModule ? (
          <section className="performance-template-detail performance-dispatch-detail" aria-labelledby="selected-dispatch-module-title">
            <div className="performance-template-detail-title">
              <div>
                <ModuleTypeTag type={selectedModule.type} />
                <h3 id="selected-dispatch-module-title">{selectedModule.name}</h3>
              </div>
              <span className="performance-dispatch-module-weight">{selectedModule.participatesInTotal ? `模块权重：${selectedModule.weight ?? 0}%` : '额外调整项'}</span>
            </div>
            <Table<PerformanceIndicator> className="performance-indicator-table" rowKey="id" columns={indicatorColumns} dataSource={selectedModule.indicators} pagination={false} scroll={{ x: 740 }} sticky={{ offsetHeader: 48, offsetScroll: 0 }} />
            <div className="performance-parse-source-note"><FileMarkdownOutlined /><span>当前模块的指标来自：{selectedModule.indicators[0]?.source ?? sourceName}</span></div>
          </section>
        ) : null}
      </div>
    </section>
  );

  const renderPermissionSettings = () => (
    <section className="performance-template-step-content" aria-labelledby="template-permission-title">
      <div className="performance-template-section-heading">
        <div>
          <span>访问边界</span>
          <h2 id="template-permission-title">权限设置</h2>
        </div>
      </div>
      <Alert type="info" showIcon message="当前模板的负责人由流程设置中的角色关系动态匹配；绩效实例启动后才会解析为具体人员。" />
      <div className="performance-permission-surface">
        <Table columns={[{ title: '角色', dataIndex: 'role', key: 'role', width: 220 }, { title: '权限范围', dataIndex: 'scope', key: 'scope' }]} dataSource={permissionRows} pagination={false} />
      </div>
    </section>
  );

  const contents = [renderBasicInformation(), renderFlowSettings(), renderAssessmentSettings(), renderDispatchIndicators(), renderPermissionSettings()];

  return (
    <section className="performance-template-editor-page" aria-labelledby="performance-template-editor-title">
      {contextHolder}
      <header className="performance-template-editor-header">
        <div className="performance-template-title-row">
          <Button type="text" aria-label="返回绩效模板" icon={<ArrowLeftOutlined />} onClick={() => navigate('/performance/templates')} />
          <div>
            <div className="performance-template-title-meta"><span>员工绩效模板</span><Tag color="cyan">Markdown 结构预览</Tag></div>
            <h1 id="performance-template-editor-title">{templateName || '未命名绩效模板'}</h1>
          </div>
        </div>
        <Button type="primary" icon={<SaveOutlined />} onClick={saveTemplate}>保存模板</Button>
      </header>

      <Steps className="performance-template-steps" current={activeStep} responsive={false} onChange={setActiveStep} items={workflowSteps.map((title) => ({ title }))} />
      {contents[activeStep]}
      <footer className="performance-template-editor-footer">
        <Button disabled={activeStep === 0} onClick={() => setActiveStep((step) => step - 1)}>上一步</Button>
        {activeStep === workflowSteps.length - 1 ? <Button type="primary" icon={<SaveOutlined />} onClick={saveTemplate}>完成并保存</Button> : <Button type="primary" onClick={() => setActiveStep((step) => step + 1)}>下一步 <DownOutlined /></Button>}
      </footer>
    </section>
  );
}
