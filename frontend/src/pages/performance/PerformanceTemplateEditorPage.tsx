import {
  ArrowDownOutlined,
  ArrowLeftOutlined,
  ArrowUpOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  FileMarkdownOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
  SwapOutlined,
  HolderOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Empty,
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
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { useEmployees, useOrganizations } from '../../features/employees/api';
import {
  createInitialPerformanceTemplate,
  getFixedWeightTotal,
  getIndicatorWeightTotal,
  getPerformanceFlowItems,
  isPerformanceWorkflowModule,
  normalizeMarkdownPerformanceModules,
  reorderPerformanceModules,
  reorderPerformanceWorkflowSteps,
  type PerformanceIndicator,
  type PerformanceModuleKind,
  type PerformanceTemplateModule,
  type PerformanceWorkflowManualStep,
  type PerformanceWorkflowManualStepType,
} from '../../features/performance/hrbp-template';

const workflowSteps = ['基本信息', '考核表设置', '流程设置', '下发指标', '权限设置'];
const workflowManualStepLabels: Record<PerformanceWorkflowManualStepType, string> = {
  REVIEW: '审核',
  CONFIRMATION: '本人确认',
  APPROVAL: '审批',
  HR_ARCHIVE: 'HR 归档',
};

type ExecutorDisplayEmployee = {
  employeeId: string;
  name: string;
  employeeNo: string;
  organizationId: string | null;
  organizationName: string | null;
};

type ExecutorPickerState = {
  filterOrganizationId?: string;
  keyword: string;
  selectedById: Record<string, ExecutorDisplayEmployee>;
};

const moduleTypeLabels: Record<PerformanceModuleKind, string> = {
  metric: '定量考核',
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

function EmptyModulePrompt({ title, description, onAdd }: { title: string; description: string; onAdd: () => void }) {
  return (
    <section className="performance-template-empty-module" aria-label={title}>
      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description}>
        <Button type="primary" icon={<PlusOutlined />} onClick={onAdd}>新增模块</Button>
      </Empty>
    </section>
  );
}

function toExecutorDisplayEmployee(employee: { id: string; name?: string | null; employeeNo?: string | null; organizationId?: string | null; organizationName?: string | null }): ExecutorDisplayEmployee {
  return {
    employeeId: employee.id,
    name: employee.name || '--',
    employeeNo: employee.employeeNo || '--',
    organizationId: employee.organizationId ?? null,
    organizationName: employee.organizationName ?? null,
  };
}

function toExecutorEmployeeSnapshot(employee: ExecutorDisplayEmployee) {
  return {
    employeeId: employee.employeeId,
    name: employee.name,
    employeeNo: employee.employeeNo,
    organizationId: employee.organizationId,
    organizationName: employee.organizationName,
  };
}

function executorPickerStateFromSnapshots(snapshots: readonly ExecutorDisplayEmployee[] | undefined): ExecutorPickerState {
  return {
    keyword: '',
    selectedById: Object.fromEntries((snapshots ?? []).map((snapshot) => [snapshot.employeeId, snapshot])),
  };
}

function formatExecutorEmployee(employee: { name?: string | null; employeeNo?: string | null; organizationName?: string | null }) {
  return `${employee.name || '--'}（${employee.employeeNo || '--'}｜${employee.organizationName || '--'}）`;
}

function serializeExecutor(executor: PerformanceTemplateModule['executor']) {
  const executionMode = executor.executionMode ?? 'SINGLE';
  if (executor.type === 'AUTO') return { type: 'AUTO' as const, executionMode: 'SINGLE' as const };
  if (executor.type === 'DIRECTORY') {
    return {
      type: 'DIRECTORY' as const,
      executionMode: 'SINGLE' as const,
      directoryType: executor.directoryType,
      directoryId: executor.directoryId,
    };
  }
  const employeeIds = [...new Set((executor.employeeIds ?? []).filter((id): id is string => Boolean(id)))];
  return {
    type: 'USER' as const,
    executionMode,
    employeeIds,
    employeeSnapshots: (executor.employeeSnapshots ?? []).filter((snapshot) => employeeIds.includes(snapshot.employeeId)),
  };
}

export function PerformanceTemplateEditorPage() {
  const navigate = useNavigate();
  const { templateId } = useParams();
  const existingTemplate = usePerformanceTemplate(templateId && templateId !== 'new' ? templateId : '');
  const options = usePerformanceOptions(true);
  const organizations = useOrganizations();
  const createTemplate = useCreatePerformanceTemplate();
  const createTemplateVersion = useCreatePerformanceTemplateVersion();
  const [messageApi, contextHolder] = message.useMessage();
  const initialTemplate = useMemo(() => createInitialPerformanceTemplate(), []);
  const [activeStep, setActiveStep] = useState(0);
  const [templateName, setTemplateName] = useState(initialTemplate.name);
  const [sourceMarkdown, setSourceMarkdown] = useState(initialTemplate.sourceMarkdown);
  const [modules, setModules] = useState<PerformanceTemplateModule[]>(initialTemplate.modules);
  const [workflowManualSteps, setWorkflowManualSteps] = useState<PerformanceWorkflowManualStep[]>(initialTemplate.workflowManualSteps);
  const [selectedModuleId, setSelectedModuleId] = useState(initialTemplate.modules[0]?.id ?? '');
  const [selectedWorkflowStepId, setSelectedWorkflowStepId] = useState('');
  const [selectedFlowItemId, setSelectedFlowItemId] = useState('');
  const [draggedModuleId, setDraggedModuleId] = useState<string | null>(null);
  const [dragOverModuleId, setDragOverModuleId] = useState<string | null>(null);
  const [draggedFlowItemId, setDraggedFlowItemId] = useState<string | null>(null);
  const [dragOverFlowItemId, setDragOverFlowItemId] = useState<string | null>(null);
  const [sourceType, setSourceType] = useState<'MARKDOWN' | 'MANUAL'>('MANUAL');
  const [sourceName, setSourceName] = useState(initialTemplate.sourceName);
  const [initializedTemplateId, setInitializedTemplateId] = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [lastExecutorSelection, setLastExecutorSelection] = useState<string | null>(null);
  const [executorPickersByModuleId, setExecutorPickersByModuleId] = useState<Record<string, ExecutorPickerState>>({});
  const [workflowExecutorPickersByStepId, setWorkflowExecutorPickersByStepId] = useState<Record<string, ExecutorPickerState>>({});

  useEffect(() => {
    const version = existingTemplate.data?.versions[0];
    if (!version || initializedTemplateId === templateId) return;
    setTemplateName(version.definition.name);
    setSourceType(version.sourceType);
    setSourceMarkdown(version.sourceMarkdown ?? '');
    setSourceName(version.sourceName ?? '');
    setModules(version.definition.modules.map((module) => ({
      ...module,
      type: module.type.toLowerCase() as PerformanceModuleKind,
      responsibleRole: module.name,
      executor: { ...module.executor, executionMode: module.executor.executionMode ?? 'SINGLE', employeeIds: module.executor.employeeIds ?? [], employeeSnapshots: module.executor.employeeSnapshots ?? [] },
      indicators: module.indicators.map((indicator) => ({ ...indicator, weightLabel: `${indicator.weight}%`, source: version.sourceName ?? '模板定义' })),
    })));
    const manualSteps = version.definition.workflow?.manualSteps ?? [];
    setWorkflowManualSteps(manualSteps.map((step) => ({
      ...step,
      // Templates saved before explicit workflow executors remain editable.
      executor: { ...step.executor, executionMode: step.executor.executionMode ?? 'SINGLE', employeeIds: step.executor.employeeIds ?? [], employeeSnapshots: step.executor.employeeSnapshots ?? [] },
    })));
    setSelectedFlowItemId(manualSteps[0]
      ? `manual:${manualSteps[0].id}`
      : `assessment:${version.definition.modules.find((module) => isPerformanceWorkflowModule({
        ...module,
        type: module.type.toLowerCase() as PerformanceModuleKind,
      }))?.id ?? ''}`);
    setSelectedModuleId(version.definition.modules[0]?.id ?? '');
    setInitializedTemplateId(templateId ?? null);
  }, [existingTemplate.data, initializedTemplateId, templateId]);

  const selectedModule = modules.find((module) => module.id === selectedModuleId) ?? modules[0];
  const flowAssessmentModules = modules.filter(isPerformanceWorkflowModule);
  const selectedFlowAssessmentModule = flowAssessmentModules.find((module) => `assessment:${module.id}` === selectedFlowItemId);
  const selectedFlowManualStep = workflowManualSteps.find((step) => `manual:${step.id}` === selectedFlowItemId);
  const selectedWorkflowStep = selectedFlowManualStep;
  const activeExecutorModule = activeStep === 2 && selectedFlowAssessmentModule
    ? selectedFlowAssessmentModule
    : selectedModule;
  const activeExecutorPicker = activeExecutorModule
    ? executorPickersByModuleId[activeExecutorModule.id]
      ?? executorPickerStateFromSnapshots((activeExecutorModule.executor.employeeSnapshots ?? []).map((snapshot) => ({
        employeeId: snapshot.employeeId,
        name: snapshot.name,
        employeeNo: snapshot.employeeNo,
        organizationId: snapshot.organizationId,
        organizationName: snapshot.organizationName,
      })))
    : executorPickerStateFromSnapshots([]);
  const updateExecutorPicker = (moduleId: string, change: Partial<ExecutorPickerState>) => {
    setExecutorPickersByModuleId((current) => ({
      ...current,
      [moduleId]: { ...executorPickerStateFromSnapshots([]), ...current[moduleId], ...change },
    }));
  };
  const resetExecutorPicker = (moduleId: string) => {
    setExecutorPickersByModuleId((current) => {
      const next = { ...current };
      delete next[moduleId];
      return next;
    });
  };
  const activeWorkflowExecutorPicker = selectedWorkflowStep
    ? workflowExecutorPickersByStepId[selectedWorkflowStep.id]
      ?? executorPickerStateFromSnapshots((selectedWorkflowStep.executor.employeeSnapshots ?? []).map((snapshot) => ({
        employeeId: snapshot.employeeId,
        name: snapshot.name,
        employeeNo: snapshot.employeeNo,
        organizationId: snapshot.organizationId,
        organizationName: snapshot.organizationName,
      })))
    : executorPickerStateFromSnapshots([]);
  const selectedWorkflowExecutorEmployeeIds = selectedWorkflowStep?.executor.employeeIds ?? [];
  const isEditingWorkflowExecutor = activeStep === 2 && Boolean(selectedWorkflowStep);
  const executorEmployees = useEmployees({
    keyword: isEditingWorkflowExecutor
      ? activeWorkflowExecutorPicker.keyword || undefined
      : activeExecutorPicker.keyword || undefined,
    organizationId: isEditingWorkflowExecutor
      ? activeWorkflowExecutorPicker.filterOrganizationId
      : activeExecutorPicker.filterOrganizationId,
    page: 1,
    pageSize: 100,
  });
  const visibleExecutorEmployees = useMemo(() => {
    const selectedById = isEditingWorkflowExecutor
      ? activeWorkflowExecutorPicker.selectedById
      : activeExecutorPicker.selectedById;
    const currentEmployees = executorEmployees.data?.data ?? [];
    return [
      ...Object.values(selectedById),
      ...currentEmployees.map(toExecutorDisplayEmployee).filter((employee) => !selectedById[employee.employeeId]),
    ];
  }, [activeExecutorPicker.selectedById, activeWorkflowExecutorPicker.selectedById, executorEmployees.data?.data, isEditingWorkflowExecutor]);
  const fixedWeightTotal = useMemo(() => getFixedWeightTotal(modules), [modules]);
  const isWeightValid = Math.abs(fixedWeightTotal - 100) < 0.0001;
  const metricIndicatorWeightIssues = useMemo(() => modules.flatMap((module) => (
    module.type === 'metric' && Math.abs(getIndicatorWeightTotal(module) - 100) >= 0.0001
      ? [`模块“${module.name}”的定量考核指标权重合计为 ${getIndicatorWeightTotal(module)}%，必须等于 100%。`]
      : []
  )), [modules]);

  const updateModule = (moduleId: string, change: Partial<PerformanceTemplateModule>) => {
    setModules((current) => current.map((module) => (module.id === moduleId ? { ...module, ...change } : module)));
  };

  const changeAssessmentModuleType = (module: PerformanceTemplateModule, type: PerformanceModuleKind) => {
    const isAdjustment = type === 'adjustment';
    updateModule(module.id, {
      type,
      participatesInTotal: isAdjustment ? false : module.participatesInTotal,
      weight: isAdjustment ? null : module.weight ?? 0,
      executor: type === 'metric'
        ? { type: 'AUTO', executionMode: 'SINGLE' }
        : module.executor.type === 'AUTO'
          ? { type: 'USER', executionMode: 'SINGLE', employeeIds: [], employeeSnapshots: [] }
          : module.executor,
      ...(isAdjustment ? {
        adjustmentDirection: module.adjustmentDirection ?? 'ADD',
        adjustmentMin: module.adjustmentMin ?? 0,
        adjustmentMax: module.adjustmentMax ?? 20,
      } : {}),
    });
  };

  const updateWorkflowStep = (stepId: string, change: Partial<PerformanceWorkflowManualStep>) => {
    setWorkflowManualSteps((current) => current.map((step) => (step.id === stepId ? { ...step, ...change } : step)));
  };

  const updateWorkflowExecutorPicker = (stepId: string, change: Partial<ExecutorPickerState>) => {
    setWorkflowExecutorPickersByStepId((current) => ({
      ...current,
      [stepId]: { ...executorPickerStateFromSnapshots([]), ...current[stepId], ...change },
    }));
  };

  const confirmExecutorSelection = (displayName: string) => {
    setLastExecutorSelection(displayName);
    messageApi.success(`已保存执行人：${displayName}`);
  };

  const addWorkflowStep = () => {
    const type: PerformanceWorkflowManualStepType = 'REVIEW';
    const id = `workflow-step-${Date.now()}`;
    const step: PerformanceWorkflowManualStep = {
      id,
      name: workflowManualStepLabels[type],
      type,
      executor: { type: 'USER', executionMode: 'SINGLE', employeeIds: [], employeeSnapshots: [] },
      rejectionStrategy: 'END',
    };
    setWorkflowManualSteps((current) => [...current, step]);
    setSelectedWorkflowStepId(id);
    setSelectedFlowItemId(`manual:${id}`);
  };

  const removeWorkflowStep = (stepId: string) => {
    setWorkflowManualSteps((current) => {
      const next = current.filter((step) => step.id !== stepId).map((step) => (
        step.rejectionTargetStepId === stepId
          ? { ...step, rejectionStrategy: 'END' as const, rejectionTargetStepId: undefined }
          : step
      ));
      setSelectedWorkflowStepId(next[0]?.id ?? '');
      setSelectedFlowItemId(next[0] ? `manual:${next[0].id}` : `assessment:${flowAssessmentModules[0]?.id ?? ''}`);
      return next;
    });
    setWorkflowExecutorPickersByStepId((current) => {
      const next = { ...current };
      delete next[stepId];
      return next;
    });
  };

  const addModule = () => {
    const id = `manual-module-${Date.now()}`;
    setModules((current) => [...current, {
      id,
      name: '新模块',
      type: 'evaluation',
      responsibleRole: '待指定执行人',
      executor: { type: 'USER', executionMode: 'SINGLE', employeeIds: [], employeeSnapshots: [] },
      enabled: true,
      participatesInTotal: true,
      weight: 0,
      description: '',
      indicators: [],
    }]);
    setSelectedModuleId(id);
  };

  const removeModule = (moduleId: string) => {
    resetExecutorPicker(moduleId);
    setModules((current) => {
      const next = current.filter((module) => module.id !== moduleId);
      setSelectedModuleId(next[0]?.id ?? '');
      return next;
    });
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
    setSourceType('MARKDOWN');
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
      const nextModules = normalizeMarkdownPerformanceModules(parsed.definition.modules.map((module) => ({
        ...module,
        type: module.type.toLowerCase() as PerformanceModuleKind,
        responsibleRole: module.executor.type === 'AUTO' ? '系统自动计算' : '待指定执行人',
        executor: { ...module.executor, executionMode: module.executor.executionMode ?? 'SINGLE', employeeIds: module.executor.employeeIds ?? [], employeeSnapshots: module.executor.employeeSnapshots ?? [] },
        indicators: module.indicators.map((indicator) => ({ ...indicator, weightLabel: `${indicator.weight}%`, source: importedSourceName })),
      })));
      setModules(nextModules);
      setWorkflowManualSteps([]);
      setSelectedModuleId(nextModules[0]?.id ?? '');
      setSelectedWorkflowStepId('');
      setSelectedFlowItemId(`assessment:${nextModules.find(isPerformanceWorkflowModule)?.id ?? ''}`);
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

  const saveCurrentSettings = () => {
    const currentTarget = activeStep === 0
      ? '基本信息'
      : activeStep === 1
        ? selectedModule ? `考核模块“${selectedModule.name}”` : '考核表设置'
        : activeStep === 2
          ? selectedFlowAssessmentModule
            ? `流程步骤“${selectedFlowAssessmentModule.name}”`
            : selectedWorkflowStep
              ? `流程步骤“${selectedWorkflowStep.name}”`
              : '流程设置'
          : selectedModule ? `模块“${selectedModule.name}”的指标设置` : '指标设置';
    messageApi.success(`${currentTarget}的修改已保留，请在权限设置中保存模板`);
  };

  const saveTemplate = async () => {
    if (!templateName.trim()) {
      setActiveStep(0);
      messageApi.error('请输入模板名称');
      return;
    }
    if (!isWeightValid) {
      setActiveStep(1);
      messageApi.error(`固定权重模块合计为 ${fixedWeightTotal}%，必须等于 100% 后才能保存模板`);
      return;
    }
    if (metricIndicatorWeightIssues.length > 0) {
      setActiveStep(3);
      messageApi.error(metricIndicatorWeightIssues[0]);
      return;
    }
    if (modules.length === 0) {
      setActiveStep(1);
      messageApi.error('至少需要配置一个绩效模块');
      return;
    }
    const invalidMetric = modules.find((module) => (
      module.type === 'metric' && module.indicators.length === 0
    ));
    if (invalidMetric) {
      setActiveStep(3);
      messageApi.error(`请为定量考核模块“${invalidMetric.name}”至少配置一个指标`);
      return;
    }
    const invalidExecutor = modules.find((module) => {
      if (module.type === 'metric') return false;
      const executor = serializeExecutor(module.executor);
      return executor.type === 'DIRECTORY'
        ? !executor.directoryType || !executor.directoryId
        : (executor.employeeIds?.length ?? 0) === 0 || (executor.executionMode === 'MULTIPLE' && (executor.employeeIds?.length ?? 0) < 2);
    });
    if (invalidExecutor) {
      setActiveStep(2);
      messageApi.error(`请为考核模块“${invalidExecutor.name}”配置有效的执行人`);
      return;
    }
    const invalidWorkflowStep = workflowManualSteps.find((step, index) => {
      if (step.type === 'CONFIRMATION') return false;
      const executor = step.executor ? serializeExecutor(step.executor) : null;
      if (!executor || (executor.type === 'DIRECTORY' ? !executor.directoryType || !executor.directoryId : (executor.employeeIds?.length ?? 0) === 0 || (executor.executionMode === 'MULTIPLE' && (executor.employeeIds?.length ?? 0) < 2))) return true;
      if (step.rejectionStrategy === 'RETURN_PREVIOUS' && index === 0) return true;
      if (step.rejectionStrategy === 'RETURN_TO_STEP' && !workflowManualSteps.slice(0, index).some((candidate) => candidate.id === step.rejectionTargetStepId)) return true;
      return false;
    });
    if (invalidWorkflowStep) {
      setActiveStep(2);
      messageApi.error(`请为流程步骤“${invalidWorkflowStep.name}”配置有效的执行人或驳回策略`);
      return;
    }
    const definition = {
      schemaVersion: 1 as const,
      name: templateName.trim(),
      description: sourceType === 'MARKDOWN' ? '依据模板 Markdown 解析的绩效流程定义。' : '手动配置的绩效流程定义。',
      modules: modules.map((module) => ({
        id: module.id,
        name: module.name,
        type: module.type.toUpperCase() as 'METRIC' | 'EVALUATION' | 'ADJUSTMENT',
        enabled: module.enabled,
        participatesInTotal: module.participatesInTotal,
        weight: module.weight,
        description: module.description,
        executor: serializeExecutor(module.executor),
        indicators: module.indicators.map((indicator) => ({ ...indicator, weight: indicator.weight ?? (Number(indicator.weightLabel.replace('%', '')) || 0) })),
        adjustmentDirection: module.adjustmentDirection,
        adjustmentMin: module.adjustmentMin,
        adjustmentMax: module.adjustmentMax,
        requireComment: module.requireComment,
        requireAttachment: module.requireAttachment,
      })),
      workflow: {
        manualSteps: workflowManualSteps.map((step) => ({
          id: step.id,
          name: step.name,
          type: step.type,
          executor: serializeExecutor(step.executor),
          ...((step.type === 'REVIEW' || step.type === 'APPROVAL') ? {
            rejectionStrategy: step.rejectionStrategy ?? 'END',
            ...(step.rejectionStrategy === 'RETURN_TO_STEP' ? { rejectionTargetStepId: step.rejectionTargetStepId } : {}),
          } : {}),
        })),
      },
    };
    try {
      const input = { name: templateName.trim(), sourceType, ...(sourceType === 'MARKDOWN' ? { sourceName, sourceMarkdown } : {}), definition };
      if (templateId && templateId !== 'new' && templateId !== 'hrbp-performance-v3') {
        await createTemplateVersion.mutateAsync({ id: templateId, input });
      } else {
        await createTemplate.mutateAsync(input);
      }
      messageApi.success('模板已保存');
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
    { title: '指标权重', dataIndex: 'weightLabel', key: 'weightLabel', width: 120, render: (_, indicator) => <InputNumber min={0} max={100} precision={2} value={indicator.weight ?? (Number(indicator.weightLabel.replace('%', '')) || 0)} onChange={(weight) => updateIndicator(selectedModule?.id ?? '', indicator.id, { weight: typeof weight === 'number' ? weight : 0, weightLabel: `${typeof weight === 'number' ? weight : 0}%` })} /> },
  ];

  const renderModuleList = (variant: 'flow' | 'assessment' | 'dispatch') => (
    <aside className={`performance-template-module-list is-${variant}`} aria-label="绩效模块列表">
      <div className="performance-flow-list-heading">
        <strong>{variant === 'assessment' ? '考核表模块' : '已解析模块'}</strong>
        {variant === 'assessment' ? <span><SwapOutlined /> 拖动调整顺序</span> : null}
        {variant === 'assessment' ? <Button size="small" icon={<PlusOutlined />} onClick={addModule}>新增模块</Button> : null}
      </div>
      <div className="performance-template-module-scroll">
        {modules.map((module, index) => (
          <button
            className={`performance-template-module-card${selectedModule?.id === module.id ? ' is-selected' : ''}${!module.enabled ? ' is-disabled' : ''}${draggedModuleId === module.id ? ' is-dragging' : ''}${dragOverModuleId === module.id && draggedModuleId !== module.id ? ' is-drop-target' : ''}`}
            key={module.id}
            type="button"
            draggable={variant === 'assessment'}
            onClick={() => setSelectedModuleId(module.id)}
            onDragStart={(event) => {
              if (variant !== 'assessment') return;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', module.id);
              setDraggedModuleId(module.id);
            }}
            onDragOver={(event) => {
              if (variant !== 'assessment' || draggedModuleId === module.id) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverModuleId(module.id);
            }}
            onDragEnd={() => {
              setDraggedModuleId(null);
              setDragOverModuleId(null);
            }}
            onDrop={(event) => {
              if (variant !== 'assessment') return;
              event.preventDefault();
              dropModule(module.id);
            }}
          >
            <span className="performance-module-card-head">
              {variant === 'assessment' ? <b>{index + 1}</b> : null}
              <strong>{module.name}</strong>
              {variant === 'assessment' ? <span className="performance-module-drag-handle" aria-label="拖动调整模块顺序"><HolderOutlined /></span> : null}
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
          <Input aria-label="模板名称" value={templateName} onChange={(event) => setTemplateName(event.target.value)} />
        </label>
        <label className="performance-template-field">
          <span>模板来源</span>
          <Select value={sourceType} options={[{ value: 'MARKDOWN', label: 'Markdown 导入' }, { value: 'MANUAL', label: '手动配置' }]} onChange={(value: 'MARKDOWN' | 'MANUAL') => {
            setSourceType(value);
            setParseWarnings([]);
            if (value === 'MANUAL') {
              setSourceMarkdown('');
              setSourceName('');
              setModules([]);
              setWorkflowManualSteps([]);
              setSelectedModuleId('');
              setSelectedWorkflowStepId('');
              setSelectedFlowItemId('');
            }
          }} />
        </label>
        <label className="performance-template-field">
          <span>模板说明</span>
          <Input.TextArea value={sourceType === 'MARKDOWN' ? '当前结构由实际导入 Markdown 解析得到；待确认项会在解析预览中提示。' : '通过手动配置维护模块、指标、执行人和评分规则。'} autoSize={{ minRows: 3, maxRows: 3 }} readOnly />
        </label>
        {sourceType === 'MARKDOWN' ? <div className="performance-template-source-card">
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
        </div> : null}
        {sourceType === 'MARKDOWN' ? <>
          <label className="performance-template-field is-source-text">
            <span>Markdown 解析内容</span>
            <Input.TextArea value={sourceMarkdown} onChange={(event) => setSourceMarkdown(event.target.value)} autoSize={{ minRows: 12, maxRows: 18 }} />
          </label>
          {parseWarnings.length ? <Alert type="warning" showIcon message="Markdown 解析需要确认" description={<ul>{parseWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>} /> : null}
          <Button icon={<ReloadOutlined />} loading={isParsing} onClick={() => void applyMarkdown(sourceMarkdown)}>使用后端重新解析当前内容</Button>
        </> : <Alert type="info" showIcon message="当前为手动配置模板" description="请在后续步骤新增模块、配置执行人、指标、权重与安全评分规则。" />}
      </div>
    </section>
  );

  const renderFlowSettings = () => {
    const flowItems = getPerformanceFlowItems(modules, workflowManualSteps);
    const workflowExecutor = selectedWorkflowStep?.executor ?? { type: 'USER' as const, executionMode: 'SINGLE' as const, employeeIds: [] };
    const canReject = selectedWorkflowStep?.type === 'REVIEW' || selectedWorkflowStep?.type === 'APPROVAL';
    const precedingSteps = selectedWorkflowStep
      ? workflowManualSteps.slice(0, workflowManualSteps.findIndex((step) => step.id === selectedWorkflowStep.id))
      : [];
    const moveFlowItem = (sourceItemId: string, targetItemId: string) => {
      const sourceAssessmentId = sourceItemId.startsWith('assessment:') ? sourceItemId.slice('assessment:'.length) : null;
      const targetAssessmentId = targetItemId.startsWith('assessment:') ? targetItemId.slice('assessment:'.length) : null;
      const sourceManualId = sourceItemId.startsWith('manual:') ? sourceItemId.slice('manual:'.length) : null;
      const targetManualId = targetItemId.startsWith('manual:') ? targetItemId.slice('manual:'.length) : null;

      if (sourceAssessmentId && targetAssessmentId) {
        setModules((current) => reorderPerformanceModules(current, sourceAssessmentId, targetAssessmentId));
      } else if (sourceManualId && targetManualId) {
        setWorkflowManualSteps((current) => reorderPerformanceWorkflowSteps(current, sourceManualId, targetManualId));
      } else {
        messageApi.warning('考核表步骤必须排在后续流程步骤之前；同一类型的步骤可拖动排序');
      }
      setDraggedFlowItemId(null);
      setDragOverFlowItemId(null);
    };
    return (
      <section className="performance-template-step-content" aria-labelledby="template-flow-title">
        <div className="performance-template-section-heading">
          <div><span>执行推进</span><h2 id="template-flow-title">流程设置</h2></div>
          <p>考核表中启用的业务达成、人工评估和结果调整会按顺序加入流程。定量考核由后端直接计算，不配置执行人也不进入流程；流程新增步骤只推进处理，不参与分数、权重或结果运算。</p>
        </div>
        <div className="performance-template-workspace performance-workflow-workspace">
          <aside className="performance-template-module-list" aria-label="绩效流程步骤列表">
            <div className="performance-flow-list-heading">
              <strong>处理顺序</strong>
              <span><HolderOutlined /> 拖动调整顺序</span>
              <Button size="small" icon={<PlusOutlined />} onClick={addWorkflowStep}>新增步骤</Button>
            </div>
            <div className="performance-template-module-scroll">
              {flowItems.map((item, index) => {
                const isAssessment = item.source === 'ASSESSMENT';
                const manualStep = item.manualStep;
                const isSelected = item.itemId === selectedFlowItemId;
                return <button
                  className={`performance-template-module-card${isSelected ? ' is-selected' : ''}${draggedFlowItemId === item.itemId ? ' is-dragging' : ''}${dragOverFlowItemId === item.itemId && draggedFlowItemId !== item.itemId ? ' is-drop-target' : ''}`}
                  key={item.itemId}
                  type="button"
                  draggable
                  onClick={() => {
                    setSelectedFlowItemId(item.itemId);
                    if (manualStep) setSelectedWorkflowStepId(manualStep.id);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = 'move';
                    event.dataTransfer.setData('text/plain', item.itemId);
                    setDraggedFlowItemId(item.itemId);
                  }}
                  onDragOver={(event) => {
                    if (!draggedFlowItemId || draggedFlowItemId === item.itemId) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverFlowItemId(item.itemId);
                  }}
                  onDragEnd={() => { setDraggedFlowItemId(null); setDragOverFlowItemId(null); }}
                  onDrop={(event) => {
                    if (!draggedFlowItemId) return;
                    event.preventDefault();
                    moveFlowItem(draggedFlowItemId, item.itemId);
                  }}
                >
                  <span className="performance-module-card-head"><b>{index + 1}</b><strong>{item.name}</strong><span className="performance-module-drag-handle" aria-label="拖动调整流程步骤顺序"><HolderOutlined /></span></span>
                  <span className="performance-module-card-meta"><Tag>{isAssessment ? item.type === 'ASSESSMENT_ADJUSTMENT' ? '结果调整' : '人工评估' : workflowManualStepLabels[item.type as PerformanceWorkflowManualStepType]}</Tag><span>{isAssessment ? '考核表步骤' : '后续操作'}</span></span>
                </button>;
              })}
              {!flowItems.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请先在考核表新增评估模块，或新增后续流程步骤" /> : null}
            </div>
          </aside>
          {selectedFlowAssessmentModule ? <section className="performance-template-detail" aria-labelledby="selected-flow-assessment-title">
            <div className="performance-template-detail-title"><div><ModuleTypeTag type={selectedFlowAssessmentModule.type} /><h3 id="selected-flow-assessment-title">{selectedFlowAssessmentModule.name}</h3></div><Tag>来自考核表</Tag></div>
            <div className="performance-template-detail-form">
              <label><span>步骤类型</span><Input value={selectedFlowAssessmentModule.type === 'adjustment' ? '结果调整' : '人工评估'} disabled /></label>
              <label><span><i>*</i> 执行人来源</span><Select aria-label="考核流程执行人来源" value={selectedFlowAssessmentModule.executor.type === 'AUTO' ? undefined : selectedFlowAssessmentModule.executor.type} options={[{ label: '具体执行人', value: 'USER' }, { label: '特定岗位名称', value: 'DIRECTORY' }]} onChange={(type: 'USER' | 'DIRECTORY') => { resetExecutorPicker(selectedFlowAssessmentModule.id); updateModule(selectedFlowAssessmentModule.id, { executor: type === 'USER' ? { type, executionMode: 'SINGLE', employeeIds: [], employeeSnapshots: [] } : { type, executionMode: 'SINGLE' } }); }} /></label>
              <label><span><i>*</i> 执行方式</span><Select aria-label="考核流程执行方式" disabled={selectedFlowAssessmentModule.executor.type === 'DIRECTORY'} value={selectedFlowAssessmentModule.executor.executionMode ?? 'SINGLE'} options={[{ label: '单人执行', value: 'SINGLE' }, { label: '多人执行', value: 'MULTIPLE', disabled: selectedFlowAssessmentModule.executor.type !== 'USER' }]} onChange={(executionMode: 'SINGLE' | 'MULTIPLE') => updateModule(selectedFlowAssessmentModule.id, { executor: { type: 'USER', executionMode, employeeIds: executionMode === 'SINGLE' ? (selectedFlowAssessmentModule.executor.employeeIds ?? []).slice(0, 1) : selectedFlowAssessmentModule.executor.employeeIds ?? [], employeeSnapshots: executionMode === 'SINGLE' ? (selectedFlowAssessmentModule.executor.employeeSnapshots ?? []).slice(0, 1) : selectedFlowAssessmentModule.executor.employeeSnapshots ?? [] } })} /></label>
              {selectedFlowAssessmentModule.executor.type === 'USER' ? <>
                <label><span>筛选部门</span><OrganizationTreeSelect aria-label="筛选考核流程执行人部门" allowClear organizations={organizations.data ?? []} placeholder="部门" value={activeExecutorPicker.filterOrganizationId} onChange={(organizationId) => updateExecutorPicker(selectedFlowAssessmentModule.id, { filterOrganizationId: organizationId ?? undefined })} /></label>
                <label><span>姓名或工号</span><Input aria-label="搜索考核流程执行人" allowClear placeholder="输入姓名或工号筛选" value={activeExecutorPicker.keyword} onChange={(event) => updateExecutorPicker(selectedFlowAssessmentModule.id, { keyword: event.target.value })} /></label>
                <label><span><i>*</i> 指定人员</span><Select aria-label="考核流程具体执行人" mode={(selectedFlowAssessmentModule.executor.executionMode ?? 'SINGLE') === 'MULTIPLE' ? 'multiple' : undefined} showSearch={false} maxTagCount="responsive" loading={executorEmployees.isFetching} options={visibleExecutorEmployees.map((employee) => ({ label: formatExecutorEmployee(employee), value: employee.employeeId }))} value={(selectedFlowAssessmentModule.executor.executionMode ?? 'SINGLE') === 'MULTIPLE' ? selectedFlowAssessmentModule.executor.employeeIds ?? [] : selectedFlowAssessmentModule.executor.employeeIds?.[0]} onChange={(value: string | string[]) => { const employeeIds = Array.isArray(value) ? value : value ? [value] : []; const selectedEmployees = employeeIds.map((employeeId) => visibleExecutorEmployees.find((employee) => employee.employeeId === employeeId) ?? activeExecutorPicker.selectedById[employeeId]).filter((employee): employee is ExecutorDisplayEmployee => Boolean(employee)); const selectedById = Object.fromEntries(selectedEmployees.map((employee) => [employee.employeeId, employee])); updateExecutorPicker(selectedFlowAssessmentModule.id, { selectedById }); updateModule(selectedFlowAssessmentModule.id, { executor: { type: 'USER', executionMode: selectedFlowAssessmentModule.executor.executionMode ?? 'SINGLE', employeeIds, employeeSnapshots: selectedEmployees.map(toExecutorEmployeeSnapshot) } }); confirmExecutorSelection(selectedEmployees.map((employee) => employee.name).join('、') || '已清空'); }} /></label>
              </> : null}
              {selectedFlowAssessmentModule.executor.type === 'DIRECTORY' ? <label><span><i>*</i> 特定岗位名称</span><Select aria-label="考核流程特定岗位名称" showSearch options={[...(options.data?.positions ?? []).map((option) => ({ label: `职位：${option.name}`, value: `POSITION:${option.id}` })), ...(options.data?.jobTitles ?? []).map((option) => ({ label: `职务：${option.code} - ${option.name}`, value: `JOB_TITLE:${option.id}` }))]} value={selectedFlowAssessmentModule.executor.directoryId ? `${selectedFlowAssessmentModule.executor.directoryType}:${selectedFlowAssessmentModule.executor.directoryId}` : undefined} onChange={(value: string) => { const [directoryType, directoryId] = value.split(':'); updateModule(selectedFlowAssessmentModule.id, { executor: { type: 'DIRECTORY', executionMode: 'SINGLE', directoryType: directoryType as 'POSITION' | 'JOB_TITLE', directoryId } }); }} /></label> : null}
            </div>
            <div className="performance-template-flow-note"><InfoCircleOutlined /><span>模块名称、启用状态、权重和指标只在考核表设置中维护；此处只配置执行人。</span></div>
          </section> : null}
          {selectedWorkflowStep ? <section className="performance-template-detail" aria-labelledby="selected-workflow-step-title">
            <div className="performance-template-detail-title"><div><Tag>{workflowManualStepLabels[selectedWorkflowStep.type]}</Tag><h3 id="selected-workflow-step-title">{selectedWorkflowStep.name}</h3></div><Tooltip title="删除后续流程步骤"><Button aria-label="删除流程步骤" danger type="text" icon={<DeleteOutlined />} onClick={() => removeWorkflowStep(selectedWorkflowStep.id)} /></Tooltip></div>
            <div className="performance-template-detail-form">
              <label><span><i>*</i> 步骤名称</span><Input aria-label="流程步骤名称" value={selectedWorkflowStep.name} onChange={(event) => updateWorkflowStep(selectedWorkflowStep.id, { name: event.target.value })} /></label>
              <label><span><i>*</i> 步骤类型</span><Select aria-label="流程步骤类型" value={selectedWorkflowStep.type} options={(Object.keys(workflowManualStepLabels) as PerformanceWorkflowManualStepType[]).map((type) => ({ label: workflowManualStepLabels[type], value: type }))} onChange={(type: PerformanceWorkflowManualStepType) => updateWorkflowStep(selectedWorkflowStep.id, { type, name: selectedWorkflowStep.name === workflowManualStepLabels[selectedWorkflowStep.type] ? workflowManualStepLabels[type] : selectedWorkflowStep.name, rejectionStrategy: type === 'REVIEW' || type === 'APPROVAL' ? selectedWorkflowStep.rejectionStrategy ?? 'END' : undefined, rejectionTargetStepId: undefined })} /></label>
              <label><span><i>*</i> 执行人来源</span><Select aria-label="流程执行人来源" value={workflowExecutor.type === 'AUTO' ? undefined : workflowExecutor.type} options={[{ label: '具体执行人', value: 'USER' }, { label: '特定岗位名称', value: 'DIRECTORY' }]} onChange={(type: 'USER' | 'DIRECTORY') => updateWorkflowStep(selectedWorkflowStep.id, { executor: type === 'USER' ? { type, executionMode: 'SINGLE', employeeIds: [], employeeSnapshots: [] } : { type, executionMode: 'SINGLE' } })} /></label>
              <label><span><i>*</i> 执行方式</span><Select aria-label="流程执行方式" disabled={workflowExecutor.type === 'DIRECTORY'} value={workflowExecutor.executionMode ?? 'SINGLE'} options={[{ label: '单人执行', value: 'SINGLE' }, { label: '多人执行', value: 'MULTIPLE', disabled: workflowExecutor.type !== 'USER' }]} onChange={(executionMode: 'SINGLE' | 'MULTIPLE') => updateWorkflowStep(selectedWorkflowStep.id, { executor: { type: 'USER', executionMode, employeeIds: executionMode === 'SINGLE' ? selectedWorkflowExecutorEmployeeIds.slice(0, 1) : selectedWorkflowExecutorEmployeeIds, employeeSnapshots: executionMode === 'SINGLE' ? (workflowExecutor.employeeSnapshots ?? []).slice(0, 1) : workflowExecutor.employeeSnapshots ?? [] } })} /></label>
              {workflowExecutor.type === 'USER' ? <>
                <label><span>筛选部门</span><OrganizationTreeSelect aria-label="筛选流程执行人部门" allowClear organizations={organizations.data ?? []} placeholder="部门" value={activeWorkflowExecutorPicker.filterOrganizationId} onChange={(organizationId) => updateWorkflowExecutorPicker(selectedWorkflowStep.id, { filterOrganizationId: organizationId ?? undefined })} /></label>
                <label><span>姓名或工号</span><Input aria-label="搜索流程执行人" allowClear placeholder="输入姓名或工号筛选" value={activeWorkflowExecutorPicker.keyword} onChange={(event) => updateWorkflowExecutorPicker(selectedWorkflowStep.id, { keyword: event.target.value })} /></label>
                <label><span><i>*</i> 指定人员</span><Select aria-label="流程具体执行人" mode={(workflowExecutor.executionMode ?? 'SINGLE') === 'MULTIPLE' ? 'multiple' : undefined} showSearch={false} maxTagCount="responsive" loading={executorEmployees.isFetching} options={visibleExecutorEmployees.map((employee) => ({ label: formatExecutorEmployee(employee), value: employee.employeeId }))} value={(workflowExecutor.executionMode ?? 'SINGLE') === 'MULTIPLE' ? selectedWorkflowExecutorEmployeeIds : selectedWorkflowExecutorEmployeeIds[0]} onChange={(value: string | string[]) => { const employeeIds = Array.isArray(value) ? value : value ? [value] : []; const selectedEmployees = employeeIds.map((employeeId) => visibleExecutorEmployees.find((employee) => employee.employeeId === employeeId) ?? activeWorkflowExecutorPicker.selectedById[employeeId]).filter((employee): employee is ExecutorDisplayEmployee => Boolean(employee)); const selectedById = Object.fromEntries(selectedEmployees.map((employee) => [employee.employeeId, employee])); updateWorkflowExecutorPicker(selectedWorkflowStep.id, { selectedById }); updateWorkflowStep(selectedWorkflowStep.id, { executor: { type: 'USER', executionMode: workflowExecutor.executionMode ?? 'SINGLE', employeeIds, employeeSnapshots: selectedEmployees.map(toExecutorEmployeeSnapshot) } }); confirmExecutorSelection(selectedEmployees.map((employee) => employee.name).join('、') || '已清空'); }} /></label>
              </> : null}
              {workflowExecutor.type === 'DIRECTORY' ? <label><span><i>*</i> 特定岗位名称</span><Select aria-label="流程特定岗位名称" showSearch options={[...(options.data?.positions ?? []).map((option) => ({ label: `职位：${option.name}`, value: `POSITION:${option.id}` })), ...(options.data?.jobTitles ?? []).map((option) => ({ label: `职务：${option.code} - ${option.name}`, value: `JOB_TITLE:${option.id}` }))]} value={workflowExecutor.directoryId ? `${workflowExecutor.directoryType}:${workflowExecutor.directoryId}` : undefined} onChange={(value: string) => { const [directoryType, directoryId] = value.split(':'); updateWorkflowStep(selectedWorkflowStep.id, { executor: { type: 'DIRECTORY', executionMode: 'SINGLE', directoryType: directoryType as 'POSITION' | 'JOB_TITLE', directoryId } }); }} /></label> : null}
              {canReject ? <>
                <label><span>驳回策略</span><Select aria-label="驳回策略" value={selectedWorkflowStep.rejectionStrategy ?? 'END'} options={[{ label: '直接结束流程', value: 'END' }, { label: '退回上一个后续步骤', value: 'RETURN_PREVIOUS', disabled: precedingSteps.length === 0 }, { label: '退回指定后续步骤', value: 'RETURN_TO_STEP', disabled: precedingSteps.length === 0 }]} onChange={(rejectionStrategy: 'END' | 'RETURN_PREVIOUS' | 'RETURN_TO_STEP') => updateWorkflowStep(selectedWorkflowStep.id, { rejectionStrategy, rejectionTargetStepId: rejectionStrategy === 'RETURN_TO_STEP' ? precedingSteps[0]?.id : undefined })} /></label>
                {selectedWorkflowStep.rejectionStrategy === 'RETURN_TO_STEP' ? <label><span>退回步骤</span><Select aria-label="退回指定步骤" value={selectedWorkflowStep.rejectionTargetStepId} options={precedingSteps.map((step) => ({ label: step.name, value: step.id }))} onChange={(rejectionTargetStepId: string) => updateWorkflowStep(selectedWorkflowStep.id, { rejectionTargetStepId })} /></label> : null}
              </> : null}
            </div>
            <div className="performance-template-flow-note"><InfoCircleOutlined /><span>此流程类型也必须指定执行人。后续流程只保存处理动作、意见与审计，不会重新打开、修改或重算考核表。</span></div>
          </section> : null}
          {!selectedFlowAssessmentModule && !selectedWorkflowStep ? <section className="performance-template-empty-module" aria-label="尚未选择流程步骤"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="请选择流程中的步骤，或通过左上方新增步骤加入后续操作。" /></section> : null}
        </div>
      </section>
    );
  };

  const renderAssessmentSettings = () => (
    <section className="performance-template-step-content" aria-labelledby="template-assessment-title">
      <div className="performance-template-section-heading">
        <div>
          <span>评分来源、权重与启用状态</span>
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
        {!selectedModule ? <EmptyModulePrompt title="尚未配置考核模块" description="请先新增模块并配置启用状态和权重。执行人请在流程设置中配置。" onAdd={addModule} /> : null}
        {selectedModule ? (
          <section className="performance-template-detail" aria-labelledby="selected-assessment-module-title">
            <div className="performance-template-detail-title">
              <div>
                <ModuleTypeTag type={selectedModule.type} />
                <h3 id="selected-assessment-module-title">{selectedModule.name}</h3>
              </div>
              <Space size={4}>
                <Tooltip title="上移模块"><Button aria-label="上移考核模块" type="text" icon={<ArrowUpOutlined />} onClick={() => moveModule(selectedModule.id, -1)} /></Tooltip>
                <Tooltip title="下移模块"><Button aria-label="下移考核模块" type="text" icon={<ArrowDownOutlined />} onClick={() => moveModule(selectedModule.id, 1)} /></Tooltip>
                <Tooltip title="删除模块"><Button aria-label="删除考核模块" danger type="text" icon={<DeleteOutlined />} onClick={() => removeModule(selectedModule.id)} /></Tooltip>
                <Switch checked={selectedModule.enabled} checkedChildren="已启用" unCheckedChildren="未启用" onChange={(enabled) => updateModule(selectedModule.id, { enabled })} />
              </Space>
            </div>
            <div className="performance-template-detail-form">
              <label><span><i>*</i> 模块名称</span><Input aria-label="考核模块名称" value={selectedModule.name} onChange={(event) => updateModule(selectedModule.id, { name: event.target.value })} /></label>
              <label>
                <span>模块类型</span>
                <Select
                  aria-label="考核模块类型"
                  value={selectedModule.type}
                  options={[{ value: 'metric', label: '定量考核' }, { value: 'evaluation', label: '人工评估' }, { value: 'adjustment', label: '结果调整' }]}
                  onChange={(type: PerformanceModuleKind) => changeAssessmentModuleType(selectedModule, type)}
                />
              </label>
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
                <Input value={selectedModule.type === 'metric' ? '定量考核由后端直接计算，不配置执行人，也不进入流程' : selectedModule.type === 'adjustment' ? '按事实依据进行额外加减分，并映射为流程步骤' : '百分制，模块总分按模块权重参与结果计算，并映射为流程步骤'} disabled />
              </label>
              <label><span>模块说明</span><Input.TextArea value={selectedModule.description} autoSize={{ minRows: 3, maxRows: 5 }} onChange={(event) => updateModule(selectedModule.id, { description: event.target.value })} /></label>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );

  const addIndicator = (moduleId: string) => {
    const id = `manual-indicator-${Date.now()}`;
    setModules((current) => current.map((module) => module.id === moduleId ? {
      ...module,
      indicators: [...module.indicators, {
        id,
        name: '新指标',
        description: '',
        standards: [],
        weightLabel: '0%',
        weight: 0,
        source: sourceType === 'MARKDOWN' ? `${sourceName}（手动新增）` : '手动配置',
      }],
    } : module));
  };

  const updateIndicator = (moduleId: string, indicatorId: string, change: Partial<PerformanceIndicator>) => {
    setModules((current) => current.map((module) => module.id === moduleId ? { ...module, indicators: module.indicators.map((indicator) => indicator.id === indicatorId ? { ...indicator, ...change } : indicator) } : module));
  };

  const removeIndicator = (moduleId: string, indicatorId: string) => {
    setModules((current) => current.map((module) => module.id === moduleId ? { ...module, indicators: module.indicators.filter((indicator) => indicator.id !== indicatorId) } : module));
  };

  const renderDispatchIndicators = () => (
    <section className="performance-template-step-content" aria-labelledby="template-dispatch-title">
      <div className="performance-template-section-heading">
        <div>
          <span>结构化指标</span>
          <h2 id="template-dispatch-title">下发指标</h2>
        </div>
        <p>指标名称、描述、衡量标准和内部权重可由 Markdown 解析后继续编辑。业务数据映射与评分口径由后端安全适配器维护。</p>
      </div>
      <Alert className="performance-indicator-alert" type="info" showIcon message="指标描述、衡量标准和评分参考来自实际 Markdown。业务模块的数据映射和安全评分规则由后端维护，不在模板页面录入；人工模块由处理人提交模块总分。" />
      <div className="performance-template-workspace">
        {renderModuleList('dispatch')}
        {!selectedModule ? <EmptyModulePrompt title="尚未配置指标模块" description="请先新增模块，或导入 Markdown 解析结构。" onAdd={addModule} /> : null}
        {selectedModule ? (
          <section className="performance-template-detail performance-dispatch-detail" aria-labelledby="selected-dispatch-module-title">
            <div className="performance-template-detail-title">
              <div>
                <ModuleTypeTag type={selectedModule.type} />
                <h3 id="selected-dispatch-module-title">{selectedModule.name}</h3>
              </div>
              <span className="performance-dispatch-module-weight">{selectedModule.participatesInTotal ? `模块权重：${selectedModule.weight ?? 0}%` : '额外调整项'}</span>
            </div>
            <Button size="small" icon={<PlusOutlined />} onClick={() => addIndicator(selectedModule.id)}>新增指标</Button>
            <Table<PerformanceIndicator> className="performance-indicator-table" rowKey="id" columns={[...indicatorColumns, { title: '编辑', key: 'editor', width: 330, render: (_, indicator) => <Space wrap><Button size="small" onClick={() => { const name = window.prompt('指标名称', indicator.name); if (name?.trim()) updateIndicator(selectedModule.id, indicator.id, { name: name.trim() }); }}>名称</Button><Button size="small" onClick={() => { const description = window.prompt('指标描述', indicator.description); if (description !== null) updateIndicator(selectedModule.id, indicator.id, { description }); }}>描述</Button><Button size="small" onClick={() => { const standards = window.prompt('衡量标准（每行一项）', indicator.standards.join('\n')); if (standards !== null) updateIndicator(selectedModule.id, indicator.id, { standards: standards.split('\n').map((item) => item.trim()).filter(Boolean) }); }}>标准</Button><Button size="small" danger onClick={() => removeIndicator(selectedModule.id, indicator.id)}>删除</Button></Space> }]} dataSource={selectedModule.indicators} pagination={false} scroll={{ x: 1400 }} sticky={{ offsetHeader: 48, offsetScroll: 0 }} />
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
      <Alert type="info" showIcon message="考核表执行人和后续流程执行人均按有效任职解析。已登录且具有处理权限的员工可网页提交；没有内部账号的有效员工可通过飞书交互卡片提交评分、确认、审核、审批或归档动作。" />
      <div className="performance-permission-surface">
        <Table columns={[{ title: '角色', dataIndex: 'role', key: 'role', width: 220 }, { title: '权限范围', dataIndex: 'scope', key: 'scope' }]} dataSource={permissionRows} pagination={false} />
      </div>
    </section>
  );

  const contents = [renderBasicInformation(), renderAssessmentSettings(), renderFlowSettings(), renderDispatchIndicators(), renderPermissionSettings()];

  return (
    <section className="performance-template-editor-page" aria-labelledby="performance-template-editor-title">
      {contextHolder}
      {lastExecutorSelection ? <output className="sr-only" aria-live="polite">已保存执行人：{lastExecutorSelection}</output> : null}
      <header className="performance-template-editor-header">
        <div className="performance-template-title-row">
          <Button type="text" aria-label="返回绩效模板" icon={<ArrowLeftOutlined />} onClick={() => navigate('/performance/templates')} />
          <div>
            <div className="performance-template-title-meta"><span>员工绩效模板</span><Tag color="cyan">Markdown 结构预览</Tag></div>
            <h1 id="performance-template-editor-title">{templateName || '未命名绩效模板'}</h1>
          </div>
        </div>
        {activeStep === workflowSteps.length - 1
          ? <Button type="primary" icon={<SaveOutlined />} onClick={saveTemplate}>保存模板</Button>
          : null}
      </header>

      <Steps className="performance-template-steps" current={activeStep} responsive={false} onChange={setActiveStep} items={workflowSteps.map((title) => ({ title }))} />
      {contents[activeStep]}
      <footer className="performance-template-editor-footer">
        {activeStep === workflowSteps.length - 1
          ? <Button type="primary" icon={<SaveOutlined />} onClick={saveTemplate}>保存模板</Button>
          : <Button type="primary" icon={<SaveOutlined />} onClick={saveCurrentSettings}>保存当前设置</Button>}
      </footer>
    </section>
  );
}
