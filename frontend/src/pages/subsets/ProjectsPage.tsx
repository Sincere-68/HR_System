import type { EmployeeSubsetListQuery } from '@hr-demo/shared';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjectList } from '../../features/employee-subsets/api';
import { SubsetsListPage } from './SubsetsListPage';
import { projectColumns } from './subset-table-configs';

function positiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useMemo<EmployeeSubsetListQuery>(() => ({
    keyword: searchParams.get('keyword') || undefined,
    organizationId: searchParams.get('organizationId') || undefined,
    page: positiveInt(searchParams.get('page'), 1),
    pageSize: positiveInt(searchParams.get('pageSize'), 10),
  }), [searchParams]);
  const projects = useProjectList(query);

  return (
    <SubsetsListPage
      title="项目经历"
      columns={projectColumns}
      query={projects}
      page={query.page ?? 1}
      pageSize={query.pageSize ?? 10}
      onPageChange={(page, pageSize) => {
        const next = new URLSearchParams(searchParams);
        next.set('page', String(page));
        next.set('pageSize', String(pageSize));
        setSearchParams(next, { replace: true });
      }}
      scrollX={1_700}
      emptyText="没有符合条件的项目经历"
    />
  );
}
