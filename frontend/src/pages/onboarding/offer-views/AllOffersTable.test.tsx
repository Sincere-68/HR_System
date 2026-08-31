import { cleanup, render, screen, within } from '@testing-library/react';
import type { OfferListItem, PaginatedOfferList } from '@hr-demo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AllOffersTable } from './AllOffersTable';

const offer: OfferListItem = {
  id: 'offer-1',
  name: '虚构候选人甲',
  personalEmail: 'candidate@example.test',
  mobile: '13800000000',
  gender: 'FEMALE',
  organizationName: '虚构研发中心',
  appliedPositionName: null,
  offeredPositionName: '虚构内部岗位',
  workplaceName: null,
  proposedEntryDate: '2026-09-03',
  probationMonths: null,
  offerSenderName: null,
  issueDate: null,
  recommenderName: null,
  acceptedAt: null,
  syncStatus: null,
  rejectedAt: null,
  rejectedReason: null,
  entryDate: '2026-09-08',
  approvalStatus: null,
  currentApproverName: null,
  offerStatus: 'APPROVED',
  resumeInfo: null,
};

function createQuery(data: OfferListItem[]) {
  return {
    data: {
      data,
      meta: {
        page: 1,
        pageSize: 10,
        total: data.length,
        totalPages: data.length ? 1 : 0,
        viewCounts: { pendingSend: 0, sent: 0, accepted: 0, rejected: 0, onboarded: 0, all: data.length },
      },
    } satisfies PaginatedOfferList,
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as never;
}

function renderTable(data: OfferListItem[]) {
  return render(
    <AllOffersTable
      query={createQuery(data)}
      page={1}
      pageSize={10}
      onPageChange={vi.fn()}
    />,
  );
}

describe('AllOffersTable', () => {
  afterEach(() => cleanup());

  it('renders the required columns, source values, placeholders, Offer status, and disabled action', () => {
    renderTable([offer]);

    const table = screen.getByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '录用部门', '应聘职位', '入职日期', '审批状态', 'offer状态', '个人邮箱', '手机号码', '操作',
    ]);
    expect(screen.getByText('虚构候选人甲')).toBeInTheDocument();
    expect(screen.getByText('虚构研发中心')).toBeInTheDocument();
    expect(screen.getByText('2026-09-08')).toBeInTheDocument();
    expect(screen.getByText('已通过')).toBeInTheDocument();
    expect(screen.getByText('candidate@example.test')).toBeInTheDocument();
    expect(screen.getByText('13800000000')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('renders the all-Offers empty state', () => {
    renderTable([]);

    expect(screen.getByText('暂无Offer记录')).toBeInTheDocument();
  });
});
