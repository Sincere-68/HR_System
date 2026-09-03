import type { OnboardingListQuery } from '@hr-demo/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { downloadOnboardingExport, useIdCardReader } from '../../features/onboarding/api';
import { OnboardingListPage } from './OnboardingListPage';
import { idCardReadColumns } from './onboarding-table-configs';
import { fieldsFromColumns, onboardingExportQuery } from './export-fields';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function IdCardReaderPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<OnboardingListQuery>(() => ({
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const records = useIdCardReader(query);

  const handlePageChange = (page: number, pageSize: number) => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    next.set('pageSize', String(pageSize));
    setSearchParams(next, { replace: true });
  };

  return (
    <OnboardingListPage
      title="读取身份证"
      columns={idCardReadColumns}
      query={records}
      page={query.page ?? 1}
      pageSize={query.pageSize ?? 10}
      onPageChange={handlePageChange}
      scrollX={2_600}
      emptyText="暂无身份证读取记录"
      exportConfig={{
        fields: fieldsFromColumns(idCardReadColumns),
        onExport: (input) => downloadOnboardingExport('id-card-reader', { ...input, query: onboardingExportQuery(query) }, '身份证读取导出'),
      }}
    />
  );
}
