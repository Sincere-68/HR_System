import type { OnboardingListQuery } from '@hr-demo/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { downloadOnboardingExport, useOnboardingIntegration } from '../../features/onboarding/api';
import { OnboardingListPage } from './OnboardingListPage';
import { integrationColumns } from './onboarding-table-configs';
import { fieldsFromColumns, onboardingExportQuery } from './export-fields';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function IntegrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<OnboardingListQuery>(() => ({
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const integration = useOnboardingIntegration(query);

  const handlePageChange = (page: number, pageSize: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  };

  return (
    <OnboardingListPage
      title="新员工融入"
      columns={integrationColumns}
      query={integration}
      page={query.page ?? 1}
      pageSize={query.pageSize ?? 10}
      onPageChange={handlePageChange}
      scrollX={1_050}
      emptyText="暂无新员工融入记录"
      exportConfig={{
        fields: fieldsFromColumns(integrationColumns),
        onExport: (input) => downloadOnboardingExport('integration', { ...input, query: onboardingExportQuery(query) }, '新员工融入导出'),
      }}
    />
  );
}
