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
  });

  it('uses four separated setup pages and only saves the template on the final page', async () => {
    const user = userEvent.setup();
    const { container } = renderEditor();

    const stepTitles = Array.from(container.querySelectorAll('.performance-template-steps .ant-steps-item-title'))
      .map((element) => element.textContent);
    expect(stepTitles).toEqual(['基本信息', '流程设置', '审批设置', '下发指标']);
    expect(screen.queryByText('权限设置')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存并下一步/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存模板' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: '模板名称' }), { target: { value: '模板名称' } });
    await user.click(screen.getByRole('button', { name: /保存并下一步/ }));
    expect(screen.getByRole('heading', { name: '流程设置' })).toBeInTheDocument();
    expect(screen.getByText('基本信息已保存，已进入流程设置')).toBeInTheDocument();

    await user.click(screen.getByText('下发指标'));
    expect(screen.getAllByRole('button', { name: /保存模板/ })).toHaveLength(2);
  });

  it('requires the current process settings before advancing and does not call the template API', async () => {
    const user = userEvent.setup();
    const createTemplateSpy = vi.spyOn(performanceApi, 'createTemplate');
    renderEditor();

    fireEvent.change(screen.getByRole('textbox', { name: '模板名称' }), { target: { value: '待完成模板' } });
    await user.click(screen.getByRole('button', { name: /保存并下一步/ }));
    expect(screen.getByRole('heading', { name: '流程设置' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /保存并下一步/ }));
    expect(screen.getByRole('heading', { name: '流程设置' })).toBeInTheDocument();
    expect(screen.getByText('至少需要配置一个绩效模块')).toBeInTheDocument();
    expect(createTemplateSpy).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: '待完成模板' })).toBeInTheDocument();
  });

  it('converts parsed business achievement to an evaluation configured in process settings', async () => {
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
    expect(screen.getByRole('heading', { name: '业务达成' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '考核执行人来源' })).toBeInTheDocument();
    expect(screen.queryByText('completionRate')).not.toBeInTheDocument();
  });

  it('keeps quantitative assessment in process settings without an executor', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('流程设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getByRole('combobox', { name: '考核模块类型' }));
    await user.click(await screen.findByText('定量考核'));

    expect(screen.getByDisplayValue('定量考核由后端直接计算，不配置执行人')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '考核执行人来源' })).not.toBeInTheDocument();
  });

  it('does not advance approval settings until every approval step has an executor', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('审批设置'));
    const approvals = screen.getByRole('complementary', { name: '绩效审批步骤列表' });
    await user.click(within(approvals).getByRole('button', { name: /新增审批步骤/ }));
    expect(screen.getByRole('combobox', { name: '审批执行人来源' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /保存并下一步/ }));

    expect(screen.getByRole('heading', { name: '审批设置' })).toBeInTheDocument();
  });

  it('keeps approval settings separate from assessment modules', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('流程设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getByText('审批设置'));

    const approvals = screen.getByRole('complementary', { name: '绩效审批步骤列表' });
    expect(within(approvals).queryByText('新模块')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '考核执行人来源' })).not.toBeInTheDocument();

    await user.click(within(approvals).getByRole('button', { name: /新增审批步骤/ }));
    expect(screen.getByRole('combobox', { name: '审批步骤类型' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '审批执行人来源' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '审核' })).toBeInTheDocument();
  });

  it('locks a confirmation step executor to the assessed employee', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('审批设置'));
    const approvals = screen.getByRole('complementary', { name: '绩效审批步骤列表' });
    await user.click(within(approvals).getByRole('button', { name: /新增审批步骤/ }));
    await user.click(screen.getByRole('combobox', { name: '审批步骤类型' }));
    await user.click(await screen.findByText('本人确认'));

    expect(screen.getByText('执行人：被考核员工')).toBeInTheDocument();
    expect(screen.getByText('活动启动后自动绑定当前活动的被考核人，不能修改。')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '审批执行人来源' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: '审批具体执行人' })).not.toBeInTheDocument();
  });

  it('keeps executor filters independent between process and approval settings', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('流程设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    fireEvent.change(screen.getByRole('textbox', { name: '搜索考核执行人' }), { target: { value: '甲' } });

    await user.click(screen.getByText('审批设置'));
    const approvals = screen.getByRole('complementary', { name: '绩效审批步骤列表' });
    await user.click(within(approvals).getByRole('button', { name: /新增审批步骤/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索审批执行人' }), { target: { value: '乙' } });

    await user.click(screen.getByText('流程设置'));
    expect(screen.getByRole('textbox', { name: '搜索考核执行人' })).toHaveValue('甲');
  });

  it('hides internal business data mappings and rule JSON from indicator dispatch', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('流程设置'));
    await user.click(screen.getAllByRole('button', { name: /新增模块/ })[0]!);
    await user.click(screen.getByText('下发指标'));

    expect(screen.queryByText('业务数据字段')).not.toBeInTheDocument();
    expect(screen.queryByText('声明式规则')).not.toBeInTheDocument();
    expect(screen.getByText(/由后端维护/)).toBeInTheDocument();
  });

  it('reorders approval steps without mixing in assessment modules', async () => {
    const user = userEvent.setup();
    renderEditor();
    await user.click(screen.getByText('审批设置'));
    const approvals = screen.getByRole('complementary', { name: '绩效审批步骤列表' });
    await user.click(within(approvals).getByRole('button', { name: /新增审批步骤/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '审批步骤名称' }), { target: { value: '第一审核' } });
    await user.click(within(approvals).getByRole('button', { name: /新增审批步骤/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '审批步骤名称' }), { target: { value: '第二审核' } });

    const source = within(approvals).getByRole('button', { name: /2 第二审核/ });
    const target = within(approvals).getByRole('button', { name: /1 第一审核/ });
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: () => undefined };
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(within(approvals).getAllByRole('button').filter((button) => button.draggable).map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^1\s*第二审核/),
      expect.stringMatching(/^2\s*第一审核/),
    ]);
  });

  it('reorders modules in process settings', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByText('流程设置'));
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
