import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OffersPage } from './OffersPage';

const useOffers = vi.fn();

vi.mock('../../features/onboarding/api', () => ({
  useOffers: (query: unknown) => useOffers(query),
}));

vi.mock('./offer-views/SentOffersTable', () => ({
  SentOffersTable: () => <div data-testid="sent-offers-table">已发Offer表格</div>,
}));
vi.mock('./offer-views/AcceptedOffersTable', () => ({
  AcceptedOffersTable: () => <div data-testid="accepted-offers-table">已接受Offer表格</div>,
}));
vi.mock('./offer-views/RejectedOffersTable', () => ({
  RejectedOffersTable: () => <div data-testid="rejected-offers-table">已拒绝Offer表格</div>,
}));
vi.mock('./offer-views/OnboardedOffersTable', () => ({
  OnboardedOffersTable: () => <div data-testid="onboarded-offers-table">已入职Offer表格</div>,
}));
vi.mock('./offer-views/AllOffersTable', () => ({
  AllOffersTable: () => <div data-testid="all-offers-table">全部Offer表格</div>,
}));

const offer = {
  id: 'offer-1',
  name: '虚构候选人甲',
  personalEmail: 'candidate@example.test',
  mobile: '13900000001',
  gender: 'FEMALE',
  organizationName: '虚构研发中心',
  appliedPositionName: null,
  offeredPositionName: '虚构内部职位',
  workplaceName: '虚构工作地点',
  proposedEntryDate: '2026-09-03',
  probationMonths: 3,
  offerSenderName: null,
  issueDate: null,
  recommenderName: null,
  acceptedAt: null,
  syncStatus: null,
  rejectedAt: null,
  rejectedReason: null,
  entryDate: null,
  approvalStatus: null,
  currentApproverName: null,
  offerStatus: 'DRAFT',
  resumeInfo: 'AVAILABLE' as const,
};

const viewCounts = {
  pendingSend: 1,
  sent: 2,
  accepted: 3,
  rejected: 4,
  onboarded: 5,
  all: 15,
};

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-search">{location.search}</output>;
}

function renderPage(initialEntry = '/onboarding/offers') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <OffersPage />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe('OffersPage', () => {
  beforeEach(() => {
    useOffers.mockReset();
    useOffers.mockReturnValue({
      data: { data: [offer], meta: { page: 2, pageSize: 20, total: 1, totalPages: 1, viewCounts } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  afterEach(() => cleanup());

  it('keeps the existing pending-Offer table columns and renders six live-count cards', () => {
    renderPage('/onboarding/offers?page=2&pageSize=20');
    const table = screen.getByRole('table');
    const columnHeaders = within(table).getAllByRole('columnheader');
    expect(columnHeaders.map((heading) => heading.textContent?.trim()).filter(Boolean)).toEqual([
      '姓名', '个人邮箱', '性别', '录用部门', '应聘职位', '预计入职日期', '审批状态', '当前审批人', '简历信息', '操作',
    ]);
    expect(screen.getByText('虚构候选人甲')).toBeInTheDocument();
    expect(screen.getByText('candidate@example.test')).toBeInTheDocument();
    expect(screen.getByText('女')).toBeInTheDocument();
    expect(screen.getByText('已上传')).toBeInTheDocument();
    expect(within(table).getAllByText('--').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByRole('button', { name: '暂无操作' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /Offer/ }).map((card) => card.textContent)).toEqual([
      '待发Offer1', '已发Offer2', '已接受Offer3', '已拒绝Offer4', '已入职Offer5', '全部Offer15',
    ]);
    expect(screen.getByRole('button', { name: '待发Offer 1' })).toHaveAttribute('aria-pressed', 'true');
    expect(useOffers).toHaveBeenLastCalledWith({ view: 'PENDING_SEND', page: 2, pageSize: 20 });
  });

  it('switches views through the URL-backed query and resets the page', () => {
    renderPage('/onboarding/offers?view=PENDING_SEND&page=3&pageSize=20');

    fireEvent.click(screen.getByRole('button', { name: '已接受Offer 3' }));

    expect(useOffers).toHaveBeenLastCalledWith({ view: 'ACCEPTED', page: 1, pageSize: 20 });
    expect(screen.getByTestId('location-search')).toHaveTextContent('?view=ACCEPTED&page=1&pageSize=20');
    expect(screen.getByTestId('accepted-offers-table')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '已接受Offer 3' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('falls back for invalid view and pagination values', () => {
    renderPage('/onboarding/offers?view=INVALID&page=bad&pageSize=0');
    expect(useOffers).toHaveBeenLastCalledWith({ view: 'PENDING_SEND', page: 1, pageSize: 10 });
  });

  it('renders the pending Offer empty state', () => {
    useOffers.mockReturnValue({
      data: { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0, viewCounts: {
        pendingSend: 0, sent: 0, accepted: 0, rejected: 0, onboarded: 0, all: 0,
      } } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderPage();
    expect(screen.getByText('暂无Offer记录')).toBeInTheDocument();
  });
});
