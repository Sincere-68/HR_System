import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
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
  afterEach(cleanup);

  it('starts as an empty manual configuration instead of a hard-coded business template', () => {
    renderEditor();

    expect(screen.getByRole('heading', { name: '未命名绩效模板' })).toBeInTheDocument();
    expect(screen.getByText('当前为手动配置模板')).toBeInTheDocument();
    expect(screen.getByText('请在后续步骤新增模块、配置执行人、指标、权重与安全评分规则。')).toBeInTheDocument();
  });

  it('allows switching to Markdown import and retains a manual module entry point', async () => {
    const user = userEvent.setup();
    renderEditor();

    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('Markdown 导入'));
    expect(screen.getByText('已解析 Markdown 来源')).toBeInTheDocument();

    await user.click(screen.getByText('流程设置'));
    expect(screen.getByText('处理顺序')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /新增步骤/ })).toBeInTheDocument();
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
