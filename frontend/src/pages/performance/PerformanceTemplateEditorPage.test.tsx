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

    expect(within(moduleList).getAllByRole('button').slice(0, 3).map((button) => button.textContent)).toEqual([
      expect.stringMatching(/^1\s*业务负责人评价/),
      expect.stringMatching(/^2\s*业务达成/),
      expect.stringMatching(/^3\s*BP负责人评价/),
    ]);
  });
});
