import type { OfferListItem } from '@hr-demo/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SentOffersTable, type SentOffersTableProps } from './SentOffersTable';

const sentOffer: OfferListItem = {
  id: 'sent-offer-1',
  name: '虚构候选人甲',
  personalEmail: 'sent-candidate@example.test',
  mobile: null,
  gender: 'FEMALE',
  organizationName: '虚构研发中心',
  appliedPositionName: null,
  offeredPositionName: '虚构前端工程师',
  workplaceName: '虚构科技园',
  proposedEntryDate: '2026-09-15',
  probationMonths: 3,
  offerSenderName: null,
  issueDate: '2026-08-31',
  recommenderName: null,
  acceptedAt: null,
  syncStatus: null,
  rejectedAt: null,
  rejectedReason: null,
  entryDate: null,
  approvalStatus: null,
  currentApproverName: null,
  offerStatus: 'COMPLETED',
  resumeInfo: null,
};

function createQuery(data: OfferListItem[]): SentOffersTableProps['query'] {
  return {
    data: {
      data,
      meta: {
        page: 1,
        pageSize: 10,
        total: data.length,
        totalPages: data.length ? 1 : 0,
        viewCounts: { pendingSend: 0, sent: data.length, accepted: 0, rejected: 0, onboarded: 0, all: data.length },
      },
    },
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  } as unknown as SentOffersTableProps['query'];
}

function renderTable(data = [sentOffer]) {
  return render(
    <SentOffersTable
      query={createQuery(data)}
      page={1}
      pageSize={10}
      onPageChange={vi.fn()}
    />,
  );
}

describe('SentOffersTable', () => {
  afterEach(() => cleanup());

  it('renders the required sent Offer columns, real fields, placeholders, gender label, and disabled action', () => {
    renderTable();

    const table = screen.getByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '录用部门', '应聘职位', '录用职位', '工作地点', '试用期(月)', '拟入职日期', '个人邮箱',
      '性别', 'Offer发送人', 'Offer发送日期', '操作',
    ]);
    expect(screen.getByText('虚构候选人甲')).toBeInTheDocument();
    expect(screen.getByText('虚构研发中心')).toBeInTheDocument();
    expect(screen.getByText('虚构前端工程师')).toBeInTheDocument();
    expect(screen.getByText('虚构科技园')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2026-09-15')).toBeInTheDocument();
    expect(screen.getByText('sent-candidate@example.test')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('2026-08-31')).toBeInTheDocument();
    expect(within(table).getAllByText('--')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
  });

  it('renders the sent Offer empty state', () => {
    renderTable([]);

    expect(screen.getByText('暂无已发Offer记录')).toBeInTheDocument();
  });
});
