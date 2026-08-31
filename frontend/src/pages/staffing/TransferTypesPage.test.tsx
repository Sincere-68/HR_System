import { cleanup, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TransferTypesPage } from './TransferTypesPage';

const useTransferTypes = vi.fn();
vi.mock('../../features/staffing/api', () => ({
  useTransferTypes: (query: unknown) => useTransferTypes(query),
}));

const row = {
  id: 'movement-type-1',
  name: '虚构部门调动',
  displayOrder: null,
  effectiveDate: null,
  status: 'ARCHIVED' as const,
};

function renderPage(entry = '/staffing/transfer-types') {
  return render(<MemoryRouter initialEntries={[entry]}><TransferTypesPage /></MemoryRouter>);
}

describe('TransferTypesPage', () => {
  beforeEach(() => {
    cleanup();
    useTransferTypes.mockReset();
    useTransferTypes.mockReturnValue({
      data: { data: [row], meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it('keeps the exact five-column order and renders only confirmed data', () => {
    renderPage();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader')
      .map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '调动类型', '显示顺序', '生效日期', '状态', '操作',
    ]);
    expect(within(table).getByText('虚构部门调动')).toBeInTheDocument();
    expect(within(table).getByText('已归档')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(2);
    expect(within(table).getByRole('button', { name: '暂无操作' })).toBeDisabled();
    expect(screen.getByText(/没有显示顺序、生效日期及维护操作来源/)).toBeInTheDocument();
  });

  it('passes URL pagination to the API query', () => {
    renderPage('/staffing/transfer-types?page=3&pageSize=20');

    expect(useTransferTypes).toHaveBeenLastCalledWith({ page: 3, pageSize: 20 });
  });

  it('shows explicit empty and error states', () => {
    useTransferTypes.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('没有符合条件的调动类型')).toBeInTheDocument();

    cleanup();
    useTransferTypes.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('网络错误'),
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('调动类型加载失败')).toBeInTheDocument();
    expect(screen.getByText('网络错误')).toBeInTheDocument();
  });
});
