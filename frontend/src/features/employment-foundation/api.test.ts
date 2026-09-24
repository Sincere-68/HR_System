import { afterEach, describe, expect, it, vi } from 'vitest';
import { employmentFoundationApi } from './api';

function jsonResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
}

describe('employmentFoundationApi', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('serializes flow and conversion list filters', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ data: [], meta: { page: 2, pageSize: 20, total: 0, totalPages: 0 } }));
    vi.stubGlobal('fetch', fetchMock);

    await employmentFoundationApi.listFlows({ keyword: '转正式', businessType: 'INTERN_TO_EMPLOYEE', page: 2, pageSize: 20 });
    await employmentFoundationApi.listConversions({ view: 'in_progress', type: 'INTERN_TO_EMPLOYEE', page: 2, pageSize: 20 });

    const calls = fetchMock.mock.calls as unknown as Array<[RequestInfo | URL, RequestInit?]>;
    const flowUrl = new URL(String(calls[0]![0]));
    const conversionUrl = new URL(String(calls[1]![0]));
    expect(flowUrl.pathname).toBe('/api/v1/employment-approval-flows');
    expect(flowUrl.searchParams.get('keyword')).toBe('转正式');
    expect(flowUrl.searchParams.get('businessType')).toBe('INTERN_TO_EMPLOYEE');
    expect(conversionUrl.pathname).toBe('/api/v1/employment/conversions');
    expect(conversionUrl.searchParams.get('view')).toBe('in_progress');
    expect(conversionUrl.searchParams.get('type')).toBe('INTERN_TO_EMPLOYEE');
  });

  it('uses exact flow management paths and bodies', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ id: 'flow-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const definition = {
      businessType: 'INTERN_TO_EMPLOYEE',
      code: 'intern-conversion',
      name: '实习转正式',
      nodes: [{ stepOrder: 1, assigneeKind: 'USER' as const, assigneeUserId: 'user-1' }],
    };

    await employmentFoundationApi.createFlow(definition);
    await employmentFoundationApi.createFlowVersion('flow-1', { nodes: definition.nodes });
    await employmentFoundationApi.publishFlowVersion('version-2');
    await employmentFoundationApi.archiveFlow('flow-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('/employment-approval-flows'), expect.objectContaining({
      method: 'POST', body: JSON.stringify(definition),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/employment-approval-flows/flow-1/versions'), expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining('/employment-approval-flows/versions/version-2/publish'), expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, expect.stringContaining('/employment-approval-flows/flow-1/archive'), expect.objectContaining({ method: 'POST' }));
  });

  it('posts approval decisions with required comments to dedicated actions', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ id: 'approval-1', status: 'REJECTED', employmentStatus: 'REJECTED' }));
    vi.stubGlobal('fetch', fetchMock);

    await employmentFoundationApi.approveApproval('approval-1', { comment: '同意' });
    await employmentFoundationApi.rejectApproval('approval-1', { comment: '条件不符' });
    await employmentFoundationApi.returnApproval('approval-1', { comment: '请补充材料' });
    await employmentFoundationApi.withdrawApproval('approval-1');

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('/employment-approvals/approval-1/approve'), expect.objectContaining({ body: JSON.stringify({ comment: '同意' }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/employment-approvals/approval-1/reject'), expect.objectContaining({ body: JSON.stringify({ comment: '条件不符' }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining('/employment-approvals/approval-1/return'), expect.objectContaining({ body: JSON.stringify({ comment: '请补充材料' }) }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, expect.stringContaining('/employment-approvals/approval-1/withdraw'), expect.objectContaining({ method: 'POST' }));
  });

  it('posts exact conversion and part-time lifecycle inputs', async () => {
    const fetchMock = vi.fn(() => jsonResponse({ id: 'business-1' }));
    vi.stubGlobal('fetch', fetchMock);
    const conversion = {
      type: 'INTERN_TO_EMPLOYEE' as const,
      employeeId: 'employee-1',
      sourceEmploymentPeriodId: 'period-1',
      targetOrganizationId: 'org-2',
      plannedEffectiveDate: '2026-09-23',
    };
    const partTime = {
      employeeId: 'employee-1',
      type: '项目顾问',
      organizationId: 'org-2',
      startDate: '2026-09-23',
    };

    await employmentFoundationApi.createConversion(conversion);
    await employmentFoundationApi.activateConversion('conversion-1');
    await employmentFoundationApi.createPartTimeRecord(partTime);
    await employmentFoundationApi.activatePartTimeRecord('part-time-1');
    await employmentFoundationApi.endPartTimeRecord('part-time-1', { endDate: '2026-12-31' });

    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('/employment/conversions'), expect.objectContaining({ body: JSON.stringify(conversion) }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/employment/conversions/conversion-1/activate'), expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, expect.stringContaining('/employment/part-time-records'), expect.objectContaining({ body: JSON.stringify(partTime) }));
    expect(fetchMock).toHaveBeenNthCalledWith(4, expect.stringContaining('/employment/part-time-records/part-time-1/activate'), expect.objectContaining({ method: 'POST' }));
    expect(fetchMock).toHaveBeenNthCalledWith(5, expect.stringContaining('/employment/part-time-records/part-time-1/end'), expect.objectContaining({ body: JSON.stringify({ endDate: '2026-12-31' }) }));
  });
});
