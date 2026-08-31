import type { OfferListItem, PaginatedOfferList } from '@hr-demo/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RejectedOffersTable } from './RejectedOffersTable';

const rejectedOffer: OfferListItem = {
  id: 'rejected-offer-1',
  name: '虚构被拒绝候选人',
  personalEmail: 'rejected-candidate@example.test',
  mobile: null,
  gender: 'FEMALE',
  organizationName: '虚构研发中心',
  appliedPositionName: null,
  offeredPositionName: '不应展示的内部岗位',
  workplaceName: null,
  proposedEntryDate: null,
  probationMonths: null,
  offerSenderName: null,
  issueDate: '2026-08-01',
  recommenderName: null,
  acceptedAt: null,
  syncStatus: null,
  rejectedAt: null,
  rejectedReason: '虚构候选人选择其他机会',
  entryDate: null,
  approvalStatus: null,
  currentApproverName: null,
  offerStatus: 'REJECTED',
  resumeInfo: null,
};

function createQuery(data: OfferListItem[]): UseQueryResult<PaginatedOfferList, Error> {
  return {
    data: {
      data,
      meta: {
        page: 1,
        pageSize: 10,
        total: data.length,
        totalPages: 1,
        viewCounts: { pendingSend: 0, sent: 0, accepted: 0, rejected: data.length, onboarded: 0, all: data.length },
      },
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<PaginatedOfferList, Error>;
}

function renderTable(data: OfferListItem[]) {
  return render(
    <RejectedOffersTable
      page={1}
      pageSize={10}
      query={createQuery(data)}
      onPageChange={vi.fn()}
    />,
  );
}

afterEach(() => cleanup());

describe('RejectedOffersTable', () => {
  it('renders the required columns, true rejection reason, placeholders, gender, and disabled action', () => {
    renderTable([rejectedOffer]);

    const table = screen.getByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '录用部门', '应聘职位', '拒绝offer日期', '拒绝原因备注', '个人邮箱', '性别', '操作',
    ]);
    expect(screen.getByText('虚构候选人选择其他机会')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(2);
    expect(screen.queryByText('不应展示的内部岗位')).not.toBeInTheDocument();
    expect(screen.queryByText('2026-08-01')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('renders the rejected Offer empty state', () => {
    renderTable([]);

    expect(screen.getByText('暂无已拒绝Offer记录')).toBeInTheDocument();
  });
});
