export type PerformanceModuleKind = 'metric' | 'evaluation' | 'adjustment';
export type PerformanceTemplateSourceKind = 'MARKDOWN' | 'MANUAL';

export interface PerformanceIndicator {
  id: string;
  name: string;
  description: string;
  standards: string[];
  weightLabel: string;
  weight?: number;
  dataField?: string;
  rule?: import('@hr-demo/shared').PerformanceRuleNode;
  source: string;
}

export interface PerformanceTemplateModule {
  id: string;
  name: string;
  type: PerformanceModuleKind;
  responsibleRole: string;
  executor: {
    type: 'AUTO' | 'USER' | 'DIRECTORY';
    executionMode?: 'SINGLE' | 'MULTIPLE';
    employeeIds?: string[];
    employeeSnapshots?: Array<{
      employeeId: string;
      name: string;
      employeeNo: string;
      organizationId: string | null;
      organizationName: string | null;
    }>;
    /** @deprecated Legacy definitions may still provide user IDs. */
    userIds?: string[];
    userId?: string;
    directoryType?: 'POSITION' | 'JOB_TITLE';
    directoryId?: string;
  };
  enabled: boolean;
  participatesInTotal: boolean;
  weight: number | null;
  description: string;
  indicators: PerformanceIndicator[];
  requireComment?: boolean;
  requireAttachment?: boolean;
  adjustmentDirection?: 'ADD' | 'DEDUCT';
  adjustmentMin?: number;
  adjustmentMax?: number;
}

export type PerformanceWorkflowManualStepType = 'REVIEW' | 'CONFIRMATION' | 'APPROVAL' | 'HR_ARCHIVE';
export type PerformanceWorkflowRejectionStrategy = 'END' | 'RETURN_PREVIOUS' | 'RETURN_TO_STEP';

export interface PerformanceWorkflowManualStep {
  id: string;
  name: string;
  type: PerformanceWorkflowManualStepType;
  /** Every manually added flow type has an explicitly selected executor. */
  executor: PerformanceTemplateModule['executor'];
  rejectionStrategy?: PerformanceWorkflowRejectionStrategy;
  rejectionTargetStepId?: string;
}

export interface PerformanceWorkflowProjectionStep {
  id: string;
  name: string;
  source: 'ASSESSMENT' | 'MANUAL';
  type: 'ASSESSMENT_EVALUATION' | 'ASSESSMENT_ADJUSTMENT' | PerformanceWorkflowManualStepType;
}

export interface ParsedPerformanceTemplate {
  id: string;
  name: string;
  sourceName: string;
  sourceMarkdown: string;
  modules: PerformanceTemplateModule[];
  workflowManualSteps: PerformanceWorkflowManualStep[];
}

/**
 * A new template deliberately starts empty. Module names, types, execution
 * settings and weights must come from HR's Markdown document or manual input,
 * never from a built-in business-specific template.
 */
export function createInitialPerformanceTemplate(): ParsedPerformanceTemplate {
  return {
    id: 'new-performance-template',
    name: '',
    sourceName: '',
    sourceMarkdown: '',
    modules: [],
    workflowManualSteps: [],
  };
}

export function reorderPerformanceModules(
  modules: PerformanceTemplateModule[],
  sourceModuleId: string,
  targetModuleId: string,
) {
  const sourceIndex = modules.findIndex((module) => module.id === sourceModuleId);
  const targetIndex = modules.findIndex((module) => module.id === targetModuleId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return modules;

  const next = [...modules];
  const [sourceModule] = next.splice(sourceIndex, 1);
  if (!sourceModule) return modules;
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex;
  next.splice(insertIndex, 0, sourceModule);
  return next;
}

export function getFixedWeightTotal(modules: PerformanceTemplateModule[]) {
  return modules.reduce(
    (total, module) => total + (module.enabled && module.participatesInTotal ? module.weight ?? 0 : 0),
    0,
  );
}

export function getIndicatorWeightTotal(module: PerformanceTemplateModule) {
  return module.indicators.reduce((total, indicator) => (
    total + (typeof indicator.weight === 'number'
      ? indicator.weight
      : Number(indicator.weightLabel.replace('%', '')) || 0)
  ), 0);
}

export function getAssessmentWorkflowProjection(modules: PerformanceTemplateModule[]): PerformanceWorkflowProjectionStep[] {
  return modules.flatMap((module) => {
    if (!module.enabled || module.type === 'metric') return [];
    return [{
      id: `assessment:${module.id}`,
      name: module.name,
      source: 'ASSESSMENT' as const,
      type: module.type === 'adjustment' ? 'ASSESSMENT_ADJUSTMENT' as const : 'ASSESSMENT_EVALUATION' as const,
    }];
  });
}

export function reorderPerformanceWorkflowSteps(
  steps: PerformanceWorkflowManualStep[],
  sourceStepId: string,
  targetStepId: string,
) {
  const sourceIndex = steps.findIndex((step) => step.id === sourceStepId);
  const targetIndex = steps.findIndex((step) => step.id === targetStepId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return steps;

  const next = [...steps];
  const [sourceStep] = next.splice(sourceIndex, 1);
  if (!sourceStep) return steps;
  next.splice(sourceIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, sourceStep);
  return next;
}

/**
 * Keep the existing flow page as one ordered list: assessment entries are
 * fixed projections and manual steps may only be reordered after them.
 */
export function getPerformanceFlowItems(
  modules: PerformanceTemplateModule[],
  manualSteps: PerformanceWorkflowManualStep[],
): Array<PerformanceWorkflowProjectionStep & { itemId: string; manualStep?: PerformanceWorkflowManualStep }> {
  return [
    ...getAssessmentWorkflowProjection(modules).map((step) => ({ ...step, itemId: `assessment:${step.id.replace(/^assessment:/, '')}` })),
    ...manualSteps.map((step) => ({
      id: step.id,
      itemId: `manual:${step.id}`,
      name: step.name,
      source: 'MANUAL' as const,
      type: step.type,
      manualStep: step,
    })),
  ];
}
