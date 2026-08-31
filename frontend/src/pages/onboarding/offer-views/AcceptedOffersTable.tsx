import type { OfferListItem } from '@hr-demo/shared';
import type { ColumnsType } from 'antd/es/table';
import { renderNullable, renderUnavailableAction } from '../OnboardingListPage';
import { OfferViewTable, type OfferViewTableProps } from './OfferViewTable';

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

function renderGender(value: OfferListItem['gender']) {
  return renderNullable(value ? genderLabels[value] : null);
}

export const acceptedOfferColumns: ColumnsType<OfferListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '录用部门', dataIndex: 'organizationName', width: 150, render: renderNullable },
  { title: '应聘职位', dataIndex: 'appliedPositionName', width: 150, render: renderNullable },
  { title: '录用职位', dataIndex: 'offeredPositionName', width: 150, render: renderNullable },
  { title: '工作地点', dataIndex: 'workplaceName', width: 150, render: renderNullable },
  { title: '拟入职日期', dataIndex: 'proposedEntryDate', width: 130, render: renderNullable },
  { title: '试用期(月)', dataIndex: 'probationMonths', width: 110, render: renderNullable },
  { title: '推荐人', dataIndex: 'recommenderName', width: 120, render: renderNullable },
  { title: '接受offer日期', dataIndex: 'acceptedAt', width: 140, render: renderNullable },
  { title: '个人邮箱', dataIndex: 'personalEmail', width: 220, render: renderNullable },
  { title: '性别', dataIndex: 'gender', width: 90, render: renderGender },
  { title: 'Offer发送人', dataIndex: 'offerSenderName', width: 130, render: renderNullable },
  { title: 'Offer发送日期', dataIndex: 'issueDate', width: 140, render: renderNullable },
  { title: '同步状态', dataIndex: 'syncStatus', width: 110, render: renderNullable },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export type AcceptedOffersTableProps = Omit<
  OfferViewTableProps,
  'columns' | 'emptyText' | 'scrollX'
>;

export function AcceptedOffersTable(props: AcceptedOffersTableProps) {
  return (
    <OfferViewTable
      {...props}
      columns={acceptedOfferColumns}
      emptyText="暂无已接受Offer记录"
      scrollX={1_990}
    />
  );
}
