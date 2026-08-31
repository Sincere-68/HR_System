import type { OfferListItem } from '@hr-demo/shared';
import type { ColumnsType } from 'antd/es/table';
import { renderNullable, renderUnavailableAction } from '../OnboardingListPage';
import { OfferViewTable, type OfferViewTableProps } from './OfferViewTable';

const genderLabels: Record<NonNullable<OfferListItem['gender']>, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

function renderGender(value: OfferListItem['gender']) {
  return renderNullable(value ? genderLabels[value] : null);
}

export const rejectedOfferColumns: ColumnsType<OfferListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '录用部门', dataIndex: 'organizationName', width: 150, render: renderNullable },
  { title: '应聘职位', dataIndex: 'appliedPositionName', width: 150, render: renderNullable },
  { title: '拒绝offer日期', dataIndex: 'rejectedAt', width: 140, render: renderNullable },
  { title: '拒绝原因备注', dataIndex: 'rejectedReason', width: 220, ellipsis: true, render: renderNullable },
  { title: '个人邮箱', dataIndex: 'personalEmail', width: 220, render: renderNullable },
  { title: '性别', dataIndex: 'gender', width: 90, render: renderGender },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export type RejectedOffersTableProps = Omit<OfferViewTableProps, 'columns' | 'emptyText' | 'scrollX'>;

export function RejectedOffersTable(props: RejectedOffersTableProps) {
  return (
    <OfferViewTable
      {...props}
      columns={rejectedOfferColumns}
      emptyText="暂无已拒绝Offer记录"
      scrollX={1_200}
    />
  );
}
