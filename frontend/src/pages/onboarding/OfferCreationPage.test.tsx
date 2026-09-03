import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OfferCreationPage } from './OfferCreationPage';

const useAuth = vi.fn();
const useInternConversionOptions = vi.fn();

vi.mock('../../features/auth/auth-context', () => ({ useAuth: () => useAuth() }));
vi.mock('../../features/onboarding/api', () => ({ useInternConversionOptions: (enabled: boolean) => useInternConversionOptions(enabled) }));

const interns = [{ id: 'intern-1', name: '虚构实习生', employeeNo: 'FAKE-I001' }];
function LocationProbe() { const location = useLocation(); return <output data-testid="location-search">{location.pathname}{location.search}</output>; }
function renderPage() { return render(<MemoryRouter initialEntries={['/onboarding/offers/templates']}><OfferCreationPage /><LocationProbe /></MemoryRouter>); }

afterEach(() => cleanup());

describe('OfferCreationPage direct creation entry', () => {
  beforeEach(() => {
    useAuth.mockReset(); useInternConversionOptions.mockReset();
    useAuth.mockReturnValue({ user: { permissions: ['employee.create'] } });
    useInternConversionOptions.mockReturnValue({ isLoading: false, isError: false, data: interns });
  });

  it('renders only direct Offer paths and does not load or save persistent template data', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Offer创建' })).toBeInTheDocument();
    expect(screen.getByText('新增人员')).toBeInTheDocument();
    expect(screen.getByText('实习生转正')).toBeInTheDocument();
    expect(screen.getByText(/不保存 Offer 模板、版本或配置/)).toBeInTheDocument();
    expect(useInternConversionOptions).toHaveBeenCalledWith(true);
    expect(screen.queryByText(/当前活动版本|保存后立即生成|预览审批人|提交审批/)).not.toBeInTheDocument();
  });

  it('navigates new hires to the clean direct creation URL', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: '新建Offer' }));
    expect(screen.getByTestId('location-search')).toHaveTextContent('/onboarding/offers/new?source=new-hire');
  });

  it('navigates a selected current intern to the direct prefill URL', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('实习生转正员工'), { target: { value: 'intern-1' } });
    fireEvent.click(screen.getByRole('button', { name: '预填并创建Offer' }));
    await waitFor(() => expect(screen.getByTestId('location-search')).toHaveTextContent('/onboarding/offers/new?source=intern-conversion&employeeId=intern-1'));
  });

  it('shows loading, API errors, scoped emptiness, and denied users safely', () => {
    useInternConversionOptions.mockReturnValue({ isLoading: true, isError: false });
    const { rerender } = renderPage();
    expect(document.querySelector('.employee-editor-loading')).toBeInTheDocument();
    useInternConversionOptions.mockReturnValue({ isLoading: false, isError: true, error: new Error('读取失败') });
    rerender(<MemoryRouter initialEntries={['/onboarding/offers/templates']}><OfferCreationPage /><LocationProbe /></MemoryRouter>);
    expect(screen.getByText('无法加载实习生转正人员')).toBeInTheDocument();
    cleanup();
    useInternConversionOptions.mockReturnValue({ isLoading: false, isError: false, data: [] });
    renderPage();
    expect(screen.getByText('当前范围内没有可转正的实习生')).toBeInTheDocument();
    cleanup();
    useAuth.mockReturnValue({ user: { permissions: ['employee.read'] } });
    renderPage();
    expect(screen.getByText('无权执行此操作')).toBeInTheDocument();
    expect(useInternConversionOptions).toHaveBeenCalledWith(false);
  });
});
