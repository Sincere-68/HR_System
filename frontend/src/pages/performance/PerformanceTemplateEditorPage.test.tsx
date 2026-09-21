import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { performanceApi } from '../../features/performance/api';
import { PerformanceTemplateEditorPage } from './PerformanceTemplateEditorPage';

function renderEditor() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PerformanceTemplateEditorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PerformanceTemplateEditorPage', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('starts as an empty manual configuration instead of a hard-coded business template', () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: '未命名绩效模板' })).toBeInTheDocument();
    expect(screen.getByText('当前为手动配置模板')).toBeInTheDocument();
    expect(screen.getByText('请在后续步骤新增模块、配置执行人、指标、权重与安全评分规则。')).toBeInTheDocument();
  });

  it('puts assessment settings before flow settings and saves without step navigation controls', async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();

    const stepTitles = Array.from(container.querySelectorAll('.performance-template-steps .ant-steps-item-title'))
      .map((element) => element.textContent);
    expect(stepTitles).toEqual(['基本信息', '考核表设置', '流程设置', '下发指标', '权限设置']);

    const footer = container.querySelector('.performance-template-editor-footer');
    expect(footer).not.toBeNull();
    expect(within(footer as HTMLElement).getByRole('button', { name: /保存当前设置/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /保存模板/ })).not.toBeInTheDocument();
    expect(within(footer as HTMLElement).queryByRole('button', { name: '上一步' })).not.toBeInTheDocument();
    expect(within(footer as HTMLElement).queryByRole('button', { name: /下一步|完成并保存/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Markdown 导入'));
    expect(screen.getByText('已解析 Markdown 来源')).toBeInTheDocument();

    await user.click(screen.getByText('流程设置'));
    expect(screen.getByText('处理顺序')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新增步骤/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存当前设置/ })).toBeInTheDocument();

    await user.click(screen.getByText('权限设置'));
    expect(screen.queryByRole('button', { name: /保存当前设置/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /保存模板/ })).toHaveLength(2);
  });

  it('keeps current-page changes locally without calling the template API', async () => {
    const user = userEvent.setup();
    const createTemplateSpy = vi.spyOn(performanceApi, 'createTemplate');
    renderEditor();

    fireEvent.change(screen.getByRole('textbox', { name: '模板名称' }), { target: { value: '待完成模板' } });
    await user.click(screen.getByRole('button', { name: /保存当前设置/ }));

    expect(createTemplateSpy).not.toHaveBeenCalled();
    expect(screen.getByText('基本信息的修改已保留，请在权限设置中保存模板')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '待完成模板' })).toBeInTheDocument();
  });

  it('converts parsed business achievement to an evaluation that requires a flow executor', async () => {
    const user = userEvent.setup();
    vi.spyOn(performanceApi, 'parseTemplate').mockResolvedValueOnce({
      sourceName: '业务模板.md',
      sourceMarkdown: '# 业务模板',
      errors: [],
      warnings: [],
      definition: {
        schemaVersion: 1,
        name: '业务模板',
        modules: [{
          id: 'business-achievement',
          name: '业务达成',
          type: 'METRIC',
          enabled: true,
          participatesInTotal: true,
          weight: 100,
          description: '达成情况',
          executor: { type: 'AUTO', executionMode: 'SINGLE' },
          indicators: [{ id: 'completion', name: '完成率', description: '', standards: ['按实际完成率评分'], weight: 100, dataField: 'completionRate', rule: { op: 'field', field: 'completionRate' } }],
        }],
      },
    });
    renderEditor();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Markdown 导入'));
    await user.click(screen.getByRole('button', { name: /使用后端重新解析当前内容/ }));
    await screen.findByRole('heading', { name: '业务模板' });

    await user.click(screen.getByText('流程设置'));
    const flow = screen.getByRole('complementary', { name: '绩效流程步骤列表' });
    expect(within(flow).getByText('业务达成')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '考核流程执行人来源' })).toBeInTheDocument();
    expect(screen.queryByText('completionRate')).not.toBeInTheDocument();
  });

  it('allows adding quantitative assessment without placing it in the workflow', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getByRole('combobox', { name: '考核模块类型' }));
    await user.click(await screen.findByText('定量考核'));

    expect(screen.getByDisplayValue('定量考核由后端直接计算，不配置执行人，也不进入流程')).toBeInTheDocument();

    await user.click(screen.getByText('流程设置'));
    const flow = screen.getByRole('complementary', { name: '绩效流程步骤列表' });
    expect(within(flow).queryByText('新模块')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '考核流程执行人来源' })).not.toBeInTheDocument();
  });

  it('allows changing a new assessment module to a score adjustment', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getByRole('combobox', { name: '考核模块类型' }));
    await user.click(await screen.findByText('结果调整'));

    expect(screen.getByText('额外调整项')).toBeInTheDocument();
  });

  it('keeps assessment and manual steps in the existing unified flow list', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getByText('流程设置'));

    const flow = screen.getByRole('complementary', { name: '绩效流程步骤列表' });
    expect(within(flow).getByText('新模块')).toBeInTheDocument();
    await user.click(within(flow).getByRole('button', { name: /新增步骤/ }));
    expect(screen.getByRole('combobox', { name: '流程步骤类型' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '流程执行人来源' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审核' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '考核执行人来源' })).not.toBeInTheDocument();
  });

  it('reorders assessment and manual items inside their persisted flow sections', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    fireEvent.change(screen.getByRole('textbox', { name: '考核模块名称' }), { target: { value: '第一评估' } });
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    fireEvent.change(screen.getByRole('textbox', { name: '考核模块名称' }), { target: { value: '第二评估' } });
    await user.click(screen.getByText('流程设置'));

    const flow = screen.getByRole('complementary', { name: '绩效流程步骤列表' });
    const assessmentSource = within(flow).getByRole('button', { name: /2 第二评估/ });
    const assessmentTarget = within(flow).getByRole('button', { name: /1 第一评估/ });
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: () => undefined };
    fireEvent.dragStart(assessmentSource, { dataTransfer });
    fireEvent.dragOver(assessmentTarget, { dataTransfer });
    fireEvent.drop(assessmentTarget, { dataTransfer });

    expect(within(flow).getAllByRole('button').filter((button) => button.draggable).map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^1\s*第二评估/),
      expect.stringMatching(/^2\s*第一评估/),
    ]);

    await user.click(within(flow).getByRole('button', { name: /新增步骤/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '流程步骤名称' }), { target: { value: '第一审核' } });
    await user.click(within(flow).getByRole('button', { name: /新增步骤/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '流程步骤名称' }), { target: { value: '第二审核' } });

    const manualSource = within(flow).getByRole('button', { name: /4 第二审核/ });
    const manualTarget = within(flow).getByRole('button', { name: /3 第一审核/ });
    fireEvent.dragStart(manualSource, { dataTransfer });
    fireEvent.dragOver(manualTarget, { dataTransfer });
    fireEvent.drop(manualTarget, { dataTransfer });

    expect(within(flow).getAllByRole('button').filter((button) => button.draggable).map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^1\s*第二评估/),
      expect.stringMatching(/^2\s*第一评估/),
      expect.stringMatching(/^3\s*第二审核/),
      expect.stringMatching(/^4\s*第一审核/),
    ]);
  });

  it('keeps assessment executor filters in the flow module instead of the assessment form', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    expect(screen.queryByRole('textbox', { name: '搜索考核执行人' })).not.toBeInTheDocument();

    await user.click(screen.getByText('流程设置'));
    const flow = screen.getByRole('complementary', { name: '绩效流程步骤列表' });
    await user.click(within(flow).getByRole('button', { name: /1 新模块/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索考核流程执行人' }), { target: { value: '甲' } });
    await user.click(screen.getByRole('button', { name: /新增步骤/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索流程执行人' }), { target: { value: '乙' } });
    await user.click(within(screen.getByRole('complementary', { name: '绩效流程步骤列表' })).getByRole('button', { name: /1 新模块/ }));

    expect(screen.getByRole('textbox', { name: '搜索考核流程执行人' })).toHaveValue('甲');
  });

  it('hides internal business data mappings and rule JSON from indicator dispatch', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getByText('下发指标'));

    expect(screen.queryByText('业务数据字段')).not.toBeInTheDocument();
    expect(screen.queryByText('声明式规则')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '填入示例规则' })).not.toBeInTheDocument();
    expect(screen.getByText(/由后端维护/)).toBeInTheDocument();
  });

  it('keeps department filtering separate from selected flow executors', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getByText('流程设置'));
    const flow = screen.getByRole('complementary', { name: '绩效流程步骤列表' });
    await user.click(within(flow).getByRole('button', { name: /1 新模块/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索考核流程执行人' }), { target: { value: '甲' } });

    await user.click(screen.getByRole('button', { name: /新增步骤/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索流程执行人' }), { target: { value: '乙' } });
    await user.click(within(flow).getByRole('button', { name: /1 新模块/ }));

    expect(screen.getByRole('textbox', { name: '搜索考核流程执行人' })).toHaveValue('甲');
    expect(screen.queryByText('undefined')).not.toBeInTheDocument();
  });

  it('reorders manually added modules in the independent assessment form', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    const moduleList = screen.getByRole('complementary', { name: '绩效模块列表' });
    const first = within(moduleList).getByRole('button', { name: /1 新模块/ });
    const second = within(moduleList).getByRole('button', { name: /2 新模块/ });
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: () => undefined };

    fireEvent.dragStart(first, { dataTransfer });
    fireEvent.dragOver(second, { dataTransfer });
    fireEvent.drop(second, { dataTransfer });

    expect(within(moduleList).getAllByRole('button').filter((button) => !button.textContent?.includes('新增模块')).map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^1\s*新模块/),
      expect.stringMatching(/^2\s*新模块/),
    ]);
  });
});
