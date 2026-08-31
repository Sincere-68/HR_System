import type { OfferListItem } from '@hr-demo/shared';
import type { ColumnsType } from 'antd/es/table';
import { renderNullable, renderUnavailableAction } from '../OnboardingListPage';
import { OfferViewTable, type OfferViewTableProps } from './OfferViewTable';

const sentOfferGenderLabels: Record<NonNullable<OfferListItem['gender']>, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

function renderSentOfferGender(value: OfferListItem['gender']) {
  return renderNullable(value ? sentOfferGenderLabels[value] : null);
}

export const sentOfferColumns: ColumnsType<OfferListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '录用部门', dataIndex: 'organizationName', width: 150, render: renderNullable },
  { title: '应聘职位', dataIndex: 'appliedPositionName', width: 150, render: renderNullable },
  { title: '录用职位', dataIndex: 'offeredPositionName', width: 150, render: renderNullable },
  { title: '工作地点', dataIndex: 'workplaceName', width: 150, render: renderNullable },
  { title: '试用期(月)', dataIndex: 'probationMonths', width: 110, render: renderNullable },
  { title: '拟入职日期', dataIndex: 'proposedEntryDate', width: 130, render: renderNullable },
  { title: '个人邮箱', dataIndex: 'personalEmail', width: 220, render: renderNullable },
  { title: '性别', dataIndex: 'gender', width: 90, render: renderSentOfferGender },
  { title: 'Offer发送人', dataIndex: 'offerSenderName', width: 120, render: renderNullable },
  { title: 'Offer发送日期', dataIndex: 'issueDate', width: 130, render: renderNullable },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export type SentOffersTableProps = Omit<OfferViewTableProps, 'columns' | 'emptyText' | 'scrollX'>;

export function SentOffersTable(props: SentOffersTableProps) {
  return (
    <OfferViewTable
      {...props}
      columns={sentOfferColumns}
      emptyText="暂无已发Offer记录"
      scrollX={1_650}
    />
  );
}
