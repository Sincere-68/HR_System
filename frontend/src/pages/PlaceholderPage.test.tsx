import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlaceholderPage } from './PlaceholderPage';

describe('PlaceholderPage', () => {
  it('renders a reusable list placeholder without business data', () => {
    render(<PlaceholderPage title="黑名单管理" />);
    expect(screen.getByRole('heading', { name: '黑名单管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '操作占位' })).toBeInTheDocument();
    expect(screen.getByText('这里什么都没有...')).toBeInTheDocument();
  });
});
