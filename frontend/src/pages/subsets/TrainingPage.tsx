import type { EmployeeSubsetListQuery } from '@hr-demo/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTrainingList } from '../../features/employee-subsets/api';
import { SubsetsListPage } from './SubsetsListPage';
import { trainingColumns } from './subset-table-configs';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function TrainingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<EmployeeSubsetListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const training = useTrainingList(query);

  return (
    <SubsetsListPage
      title="培训经历"
      columns={trainingColumns}
      query={training}
      page={query.page ?? 1}
      pageSize={query.pageSize ?? 10}
      onPageChange={(page, pageSize) => {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(page));
        next.set('pageSize', String(pageSize));
        setSearchParams(next, { replace: true });
      }}
      scrollX={1_700}
      emptyText="没有符合条件的培训经历"
    />
  );
}
