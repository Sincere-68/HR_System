import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { PlaceholderPage } from './PlaceholderPage';

describe('PlaceholderPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders a reusable list placeholder without business data', () => {
    render(
      <MemoryRouter>
        <PlaceholderPage title="黑名单管理" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { name: '黑名单管理' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '操作占位' })).toBeInTheDocument();
    expect(screen.getByText('这里什么都没有...')).toBeInTheDocument();
  });

  it('keeps pending-field pages free of invented tables, filters, actions, and API-backed states', () => {
    render(
      <MemoryRouter initialEntries={['/employment/reporting-lines?view=1&page=4&pageSize=50']}>
        <PlaceholderPage
          title="汇报关系"
          routePath="/employment/reporting-lines"
          headingTabs={['汇报关系', '汇报关系图']}
          pendingFields
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: '汇报关系' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '汇报关系' })).toHaveAttribute(
      'href',
      '/employment/reporting-lines?view=0',
    );
    expect(screen.getByRole('link', { name: '汇报关系图' })).toHaveAttribute(
      'href',
      '/employment/reporting-lines?view=1',
    );
    expect(screen.getByRole('status')).toHaveTextContent('字段待确认');
    expect(screen.getByRole('status')).toHaveTextContent('当前不发起数据请求');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/字段一|字段二|操作占位|筛选字段|指标一/)).not.toBeInTheDocument();
  });
});
