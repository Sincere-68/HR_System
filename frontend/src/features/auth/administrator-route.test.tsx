import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdministratorRoute } from './administrator-route';

const useAuth = vi.fn();

vi.mock('./auth-context', () => ({
  useAuth: () => useAuth(),
}));

function renderRoute(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdministratorRoute />}>
          <Route path="/personnel/employees" element={<h1>人员信息</h1>} />
        </Route>
        <Route path="/login" element={<h1>登录系统</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('AdministratorRoute', () => {
  it('shows the restricted page for a normal account', () => {
    useAuth.mockReturnValue({ user: { role: 'VIEWER' }, logout: vi.fn() });

    renderRoute('/personnel/employees');

    expect(screen.getByText('当前账户暂未开放信息访问')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '人员信息' })).not.toBeInTheDocument();
  });

  it('renders business content for an administrator account', () => {
    useAuth.mockReturnValue({ user: { role: 'ADMIN' }, logout: vi.fn() });

    renderRoute('/personnel/employees');

    expect(screen.getByRole('heading', { name: '人员信息' })).toBeInTheDocument();
  });
});
