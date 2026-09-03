import type { OnboardingListQuery } from '@hr-demo/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { downloadOnboardingExport, useOnboardingEntries } from '../../features/onboarding/api';
import { OnboardingListPage } from './OnboardingListPage';
import { entryColumns } from './onboarding-table-configs';
import { fieldsFromColumns, onboardingExportQuery } from './export-fields';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function EntriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<OnboardingListQuery>(() => ({
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const entries = useOnboardingEntries(query);

  const handlePageChange = (page: number, pageSize: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  };

  return (
    <OnboardingListPage
      title="入职管理"
      columns={entryColumns}
      query={entries}
      page={query.page ?? 1}
      pageSize={query.pageSize ?? 10}
      onPageChange={handlePageChange}
      scrollX={3_100}
      emptyText="暂无入职记录"
      exportConfig={{
        fields: fieldsFromColumns(entryColumns),
        onExport: (input) => downloadOnboardingExport('entries', { ...input, query: onboardingExportQuery(query) }, '入职管理导出'),
      }}
    />
  );
}
