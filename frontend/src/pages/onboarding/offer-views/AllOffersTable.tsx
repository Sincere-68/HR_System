import type { OfferListItem } from '@hr-demo/shared';
import type { ColumnsType } from 'antd/es/table';
import { renderNullable, renderUnavailableAction } from '../OnboardingListPage';
import { renderOnboardingStatus } from '../onboarding-table-configs';
import { OfferViewTable, type OfferViewTableProps } from './OfferViewTable';

export const allOfferColumns: ColumnsType<OfferListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '录用部门', dataIndex: 'organizationName', width: 150, render: renderNullable },
  { title: '应聘职位', dataIndex: 'appliedPositionName', width: 150, render: renderNullable },
  { title: '入职日期', dataIndex: 'entryDate', width: 130, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 110, render: renderNullable },
  { title: 'offer状态', dataIndex: 'offerStatus', width: 110, render: renderOnboardingStatus },
  { title: '个人邮箱', dataIndex: 'personalEmail', width: 220, render: renderNullable },
  { title: '手机号码', dataIndex: 'mobile', width: 140, render: renderNullable },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export type AllOffersTableProps = Omit<OfferViewTableProps, 'columns' | 'emptyText' | 'scrollX'>;

export function AllOffersTable(props: AllOffersTableProps) {
  return <OfferViewTable {...props} columns={allOfferColumns} emptyText="暂无Offer记录" scrollX={1_340} />;
}
