import type { OfferListItem, PaginatedOfferList } from '@hr-demo/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { UseQueryResult } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AcceptedOffersTable } from './AcceptedOffersTable';

const acceptedOffer: OfferListItem = {
  id: 'accepted-offer-1',
  name: '虚构候选人甲',
  personalEmail: 'candidate@example.test',
  mobile: '13800000000',
  gender: 'FEMALE',
  organizationName: '虚构研发中心',
  appliedPositionName: null,
  offeredPositionName: '虚构测试工程师',
  workplaceName: '虚构上海办公室',
  proposedEntryDate: '2026-09-03',
  probationMonths: 3,
  offerSenderName: null,
  issueDate: '2026-08-20',
  recommenderName: null,
  acceptedAt: '2026-08-21',
  syncStatus: null,
  rejectedAt: null,
  rejectedReason: null,
  entryDate: null,
  approvalStatus: null,
  currentApproverName: null,
  offerStatus: 'APPROVED',
  resumeInfo: 'AVAILABLE',
};

function createQuery(data: OfferListItem[]): UseQueryResult<PaginatedOfferList, Error> {
  return {
    data: {
      data,
      meta: {
        page: 1,
        pageSize: 10,
        total: data.length,
        totalPages: data.length ? 1 : 0,
        viewCounts: { pendingSend: 0, sent: 0, accepted: data.length, rejected: 0, onboarded: 0, all: data.length },
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as UseQueryResult<PaginatedOfferList, Error>;
}

function renderTable(data: OfferListItem[]) {
  return render(
    <AcceptedOffersTable
      query={createQuery(data)}
      page={1}
      pageSize={10}
      onPageChange={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe('AcceptedOffersTable', () => {
  it('renders the exact columns with reliable values and placeholders for unavailable fields', () => {
    renderTable([acceptedOffer]);

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '录用部门', '应聘职位', '录用职位', '工作地点', '拟入职日期', '试用期(月)', '推荐人',
      '接受offer日期', '个人邮箱', '性别', 'Offer发送人', 'Offer发送日期', '同步状态', '操作',
    ]);
    expect(within(table).getByText('虚构候选人甲')).toBeInTheDocument();
    expect(within(table).getByText('虚构研发中心')).toBeInTheDocument();
    expect(within(table).getByText('虚构测试工程师')).toBeInTheDocument();
    expect(within(table).getByText('虚构上海办公室')).toBeInTheDocument();
    expect(within(table).getByText('2026-09-03')).toBeInTheDocument();
    expect(within(table).getByText('3')).toBeInTheDocument();
    expect(within(table).getByText('2026-08-21')).toBeInTheDocument();
    expect(within(table).getByText('candidate@example.test')).toBeInTheDocument();
    expect(within(table).getByText('女')).toBeInTheDocument();
    expect(within(table).getByText('2026-08-20')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(4);
    expect(within(table).getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('renders the accepted Offer empty state', () => {
    renderTable([]);

    expect(screen.getByText('暂无已接受Offer记录')).toBeInTheDocument();
  });
});
