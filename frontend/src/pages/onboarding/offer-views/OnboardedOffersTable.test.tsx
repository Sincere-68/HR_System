import type { OfferListItem } from '@hr-demo/shared';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { OfferViewTableProps } from './OfferViewTable';
import { OnboardedOffersTable } from './OnboardedOffersTable';

const firstOffer = {
  id: 'offer-onboarded-1',
  name: '虚构已入职员工甲',
  personalEmail: 'personal@example.test',
  mobile: null,
  gender: 'FEMALE',
  organizationName: '虚构研发中心',
  appliedPositionName: null,
  offeredPositionName: '高级测试工程师',
  workplaceName: '虚构办公地点',
  proposedEntryDate: '2026-08-01',
  probationMonths: null,
  offerSenderName: null,
  issueDate: null,
  recommenderName: null,
  acceptedAt: null,
  syncStatus: null,
  rejectedAt: null,
  rejectedReason: null,
  entryDate: '2026-08-03',
  approvalStatus: null,
  currentApproverName: null,
  offerStatus: 'COMPLETED',
  resumeInfo: null,
} as OfferListItem;

const secondOffer = {
  ...firstOffer,
  id: 'offer-onboarded-2',
  name: '虚构已入职员工乙',
  personalEmail: null,
  gender: null,
  recommenderName: null,
} as OfferListItem;

function createQuery(data: OfferListItem[]): OfferViewTableProps['query'] {
  return {
    data: {
      data,
      meta: {
        page: 1,
        pageSize: 10,
        total: data.length,
        totalPages: data.length > 0 ? 1 : 0,
        viewCounts: { pendingSend: 0, sent: 0, accepted: 0, rejected: 0, onboarded: data.length, all: data.length },
      },
    },
    isLoading: false,
    isError: false,
    refetch: async () => undefined,
  } as unknown as OfferViewTableProps['query'];
}

function renderTable(data: OfferListItem[] = [firstOffer, secondOffer]) {
  return render(
    <OnboardedOffersTable
      query={createQuery(data)}
      page={1}
      pageSize={10}
      onPageChange={() => undefined}
    />,
  );
}

describe('OnboardedOffersTable', () => {
  afterEach(() => cleanup());

  it('renders the required columns, values, placeholders, gender label, and disabled action', () => {
    renderTable();

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '部门', '录用职位', '入职日期', '工作地点', '推荐人', '邮箱', '性别', '操作',
    ]);

    const firstRow = screen.getByText('虚构已入职员工甲').closest('tr');
    expect(firstRow).not.toBeNull();
    expect(within(firstRow as HTMLElement).getByText('虚构研发中心')).toBeInTheDocument();
    expect(within(firstRow as HTMLElement).getByText('高级测试工程师')).toBeInTheDocument();
    expect(within(firstRow as HTMLElement).getByText('2026-08-03')).toBeInTheDocument();
    expect(within(firstRow as HTMLElement).getByText('虚构办公地点')).toBeInTheDocument();
    expect(within(firstRow as HTMLElement).getByText('personal@example.test')).toBeInTheDocument();
    expect(within(firstRow as HTMLElement).getByText('女')).toBeInTheDocument();
    expect(within(firstRow as HTMLElement).getByText('--')).toBeInTheDocument();

    const secondRow = screen.getByText('虚构已入职员工乙').closest('tr');
    expect(secondRow).not.toBeNull();
    expect(within(secondRow as HTMLElement).getAllByText('--').length).toBeGreaterThan(0);
    expect(within(secondRow as HTMLElement).queryByText('personal@example.test')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '暂无操作' })).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: '暂无操作' }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });

  it('renders the explicit empty state', () => {
    renderTable([]);

    expect(screen.getByText('暂无已入职Offer记录')).toBeInTheDocument();
  });
});
