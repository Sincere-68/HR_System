import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { PerformanceTemplatesPage } from './PerformanceTemplatesPage';

const copyTemplate = vi.fn();
const archiveTemplate = vi.fn();
vi.mock('../../features/performance/api', () => ({
  usePerformanceTemplates: () => ({ data: [{ id: 'template-1', name: '原模板', description: null, status: 'ACTIVE', configurationStatus: 'PUBLISHED', moduleCount: 2, createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z', latestVersion: { id: 'version-1', versionNo: 1, status: 'PUBLISHED', sourceName: 'source.md', createdAt: '2026-09-01T00:00:00.000Z', publishedAt: '2026-09-01T00:00:00.000Z' } }], isLoading: false, isError: false }),
  useCopyPerformanceTemplate: () => ({ isPending: false, mutateAsync: copyTemplate }),
  useArchivePerformanceTemplate: () => ({ isPending: false, mutateAsync: archiveTemplate }),
}));

describe('PerformanceTemplatesPage', () => {
  afterEach(() => cleanup());

  it('shows a saved published template as available instead of pending configuration', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><PerformanceTemplatesPage /></MemoryRouter></QueryClientProvider>);

    expect(screen.getByText('已发布')).toBeInTheDocument();
    expect(screen.queryByText('待配置')).not.toBeInTheDocument();
  });

  it('copies a template and opens its new draft editor', async () => {
    copyTemplate.mockResolvedValue({ id: 'template-copy', name: '原模板 副本' });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><PerformanceTemplatesPage /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /复制$/ }));
    expect(copyTemplate).toHaveBeenCalledWith('template-1');
  });

  it('opens archive confirmation from the delete action', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><PerformanceTemplatesPage /></MemoryRouter></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button', { name: /删除/ }));
    expect(screen.getByText('删除绩效模板')).toBeInTheDocument();
    expect(screen.getByText(/不会删除历史版本/)).toBeInTheDocument();
  });
});
