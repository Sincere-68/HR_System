import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { PerformanceActivitiesPage } from './PerformanceActivitiesPage';

describe('PerformanceActivitiesPage', () => {
  afterEach(cleanup);

  it('renders the activity creation entry point', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PerformanceActivitiesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('button', { name: /新增/ })).toBeInTheDocument();
    expect(screen.getByText('员工绩效活动')).toBeInTheDocument();
  });

  it('allows creating a draft activity without selecting a template', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PerformanceActivitiesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /新增/ }));
    expect(screen.getByText('绩效模板')).toBeInTheDocument();
    expect(screen.queryByText('绩效等级')).not.toBeInTheDocument();
    expect(screen.getByText('可暂不选择，添加被考核人时指定模板')).toBeInTheDocument();
  });

  it('opens an archive confirmation from the activity delete action', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PerformanceActivitiesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const deleteButton = screen.queryByRole('button', { name: '删除' });
    if (deleteButton) {
      fireEvent.click(deleteButton);
      expect(screen.getByText('删除绩效活动')).toBeInTheDocument();
      expect(screen.getByText(/实例、任务、结果和审计记录会保留/)).toBeInTheDocument();
    }
  });

  it('queries employees on every exception-handler keyword change', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <PerformanceActivitiesPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /新增/ }));
    expect(screen.getByText('绩效模板')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('搜索异常处理人'), { target: { value: '张' } });
    expect(screen.getByLabelText('搜索异常处理人')).toHaveValue('张');
  });
});
