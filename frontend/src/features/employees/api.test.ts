import type { EmployeeListItem } from '@hr-demo/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAllEmployees } from './api';

function employee(id: string) {
  return { id } as EmployeeListItem;
}

describe('fetchAllEmployees', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('loads every backend-supported employee page for a reporting hierarchy', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get('page'));
      const responses = {
        1: {
          data: [employee('employee-1')],
          meta: { page: 1, pageSize: 100, total: 201, totalPages: 3 },
        },
        2: {
          data: [employee('employee-2')],
          meta: { page: 2, pageSize: 100, total: 201, totalPages: 3 },
        },
        3: {
          data: [employee('employee-3')],
          meta: { page: 3, pageSize: 100, total: 201, totalPages: 3 },
        },
      } as const;

      return Promise.resolve(new Response(JSON.stringify(responses[page as 1 | 2 | 3]), {
        headers: { 'Content-Type': 'application/json' },
      }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchAllEmployees({
      keyword: '王',
      organizationId: 'organization-1',
    });

    expect(result.data.map((item) => item.id)).toEqual([
      'employee-1',
      'employee-2',
      'employee-3',
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const requests = fetchMock.mock.calls.map(([input]) => new URL(String(input)));
    expect(requests.map((url) => url.searchParams.get('page'))).toEqual(['1', '2', '3']);
    expect(requests.every((url) => url.searchParams.get('pageSize') === '100')).toBe(true);
    expect(requests.every((url) => url.searchParams.get('keyword') === '王')).toBe(true);
    expect(requests.every((url) => url.searchParams.get('organizationId') === 'organization-1')).toBe(true);
  });
});
