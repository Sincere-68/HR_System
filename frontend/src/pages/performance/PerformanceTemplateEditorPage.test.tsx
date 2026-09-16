import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { PerformanceTemplateEditorPage } from './PerformanceTemplateEditorPage';

describe('PerformanceTemplateEditorPage', () => {
  afterEach(cleanup);

  it('shows the parsed fixed-weight total in the assessment settings', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PerformanceTemplateEditorPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByText('考核表设置'));
    expect(screen.getByText('固定模块权重 100% / 100%')).toBeInTheDocument();

    expect(screen.getByRole('status')).toHaveClass('is-valid');
    expect(screen.getByRole('status')).toHaveTextContent('固定模块权重 100% / 100%');
  });

  it('allows switching to an empty manual template configuration', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><PerformanceTemplateEditorPage /></MemoryRouter></QueryClientProvider>);
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByText('手动配置'));
    await user.click(screen.getByText('流程设置'));
    expect(screen.getByRole('button', { name: /新增模块/ })).toBeInTheDocument();
  });

  it('supports multiple assignees and exposes department and keyword filters', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><PerformanceTemplateEditorPage /></MemoryRouter></QueryClientProvider>);
    await user.click(screen.getByText('流程设置'));
    await user.click(screen.getByRole('button', { name: /2 业务负责人评价/ }));
    await user.click(screen.getByRole('combobox', { name: '执行方式' }));
    await user.click(await screen.findByText('多人执行'));
    expect(screen.getByRole('combobox', { name: '筛选执行人部门' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '搜索执行人' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '具体执行人' })).toBeInTheDocument();
  });

  it('keeps executor filter state separate for each module across wizard steps', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><MemoryRouter><PerformanceTemplateEditorPage /></MemoryRouter></QueryClientProvider>);

    await user.click(screen.getByText('流程设置'));
    await user.click(screen.getByRole('button', { name: /2 业务负责人评价/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索执行人' }), { target: { value: '甲' } });
    await user.click(screen.getByRole('button', { name: /3 BP负责人评价/ }));
    fireEvent.change(screen.getByRole('textbox', { name: '搜索执行人' }), { target: { value: '乙' } });
    await user.click(screen.getByRole('button', { name: /2 业务负责人评价/ }));
    expect(screen.getByRole('textbox', { name: '搜索执行人' })).toHaveValue('甲');
    await user.click(screen.getByText('考核表设置'));
    await user.click(screen.getByText('流程设置'));
    expect(screen.getByRole('textbox', { name: '搜索执行人' })).toHaveValue('甲');
  });

  it('reorders the strict workflow when a module is dropped on another module', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <PerformanceTemplateEditorPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByText('流程设置'));
    const moduleList = screen.getByRole('complementary', { name: '绩效模块列表' });
    const businessAchievement = within(moduleList).getByRole('button', { name: /1 业务达成/ });
    const bpOwnerReview = within(moduleList).getByRole('button', { name: /3 BP负责人评价/ });
    const dataTransfer = { effectAllowed: '', dropEffect: '', setData: () => undefined };

    fireEvent.dragStart(businessAchievement, { dataTransfer });
    fireEvent.dragOver(bpOwnerReview, { dataTransfer });
    fireEvent.drop(bpOwnerReview, { dataTransfer });

    expect(within(moduleList).getAllByRole('button').filter((button) => !button.textContent?.includes('新增模块')).slice(0, 3).map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^1\s*业务负责人评价/),
      expect.stringMatching(/^2\s*业务达成/),
      expect.stringMatching(/^3\s*BP负责人评价/),
    ]);
  });
});
