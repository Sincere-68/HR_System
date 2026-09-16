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
    expect(screen.getByText('绩效等级')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('搜索异常处理人'), { target: { value: '张' } });
    expect(screen.getByLabelText('搜索异常处理人')).toHaveValue('张');
  });
});
