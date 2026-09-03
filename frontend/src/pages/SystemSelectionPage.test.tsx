import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SystemSelectionPage } from './SystemSelectionPage';

vi.mock('../features/auth/auth-context', () => ({
  useAuth: () => ({
    user: { displayName: '管理员', roleName: '系统管理员' },
    logout: vi.fn(),
  }),
}));

describe('SystemSelectionPage', () => {
  it('links users to the personnel and performance workspaces', () => {
    render(
      <MemoryRouter>
        <SystemSelectionPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /人员管理/ })).toHaveAttribute('href', '/personnel/employees');
    expect(screen.getByRole('link', { name: /绩效系统/ })).toHaveAttribute('href', '/performance');
  });
});
