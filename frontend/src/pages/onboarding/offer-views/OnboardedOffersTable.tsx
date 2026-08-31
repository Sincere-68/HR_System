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
  return renderNullable(value ? genderLabels[value] ?? value : null);
}

export const onboardedOfferColumns: ColumnsType<OfferListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'organizationName', width: 150, render: renderNullable },
  { title: '录用职位', dataIndex: 'offeredPositionName', width: 150, render: renderNullable },
  { title: '入职日期', dataIndex: 'entryDate', width: 130, render: renderNullable },
  { title: '工作地点', dataIndex: 'workplaceName', width: 150, render: renderNullable },
  { title: '推荐人', dataIndex: 'recommenderName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'personalEmail', width: 220, render: renderNullable },
  { title: '性别', dataIndex: 'gender', width: 90, render: renderGender },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export type OnboardedOffersTableProps = Omit<OfferViewTableProps, 'columns' | 'emptyText' | 'scrollX'>;

export function OnboardedOffersTable(props: OnboardedOffersTableProps) {
  return (
    <OfferViewTable
      {...props}
      columns={onboardedOfferColumns}
      emptyText="暂无已入职Offer记录"
      scrollX={1_310}
    />
  );
}
