import type {
  EmployeeIntroductionListItem,
  IdCardReadListItem,
  OfferListItem,
  OnboardingEntryListItem,
  OnboardingIntegrationListItem,
} from '@hr-demo/shared';
import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ReactNode } from 'react';
import { renderAgreementType } from '../../config/agreement-types';
import { renderNullable, renderUnavailableAction } from './OnboardingListPage';

export const onboardingStatusLabels: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待处理',
  IN_PROGRESS: '进行中',
  COMPLETED: '已完成',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  WITHDRAWN: '已撤回',
  CANCELLED: '已取消',
};

export function renderOnboardingStatus(value: string | null | undefined): ReactNode {
  if (!value) return '--';
  return <Tag>{onboardingStatusLabels[value] ?? value}</Tag>;
}

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

export function renderGender(value: string | null | undefined) {
  return renderNullable(value ? genderLabels[value] ?? value : null);
}

const identityDocumentTypeLabels: Record<string, string> = {
  NATIONAL_ID: '居民身份证',
  PASSPORT: '护照',
  HK_MACAO_PERMIT: '港澳居民来往内地通行证',
  TAIWAN_PERMIT: '台湾居民来往大陆通行证',
  RESIDENCE_PERMIT: '居住证',
  OTHER: '其他',
};

function renderIdentityDocumentType(value: IdCardReadListItem['documentType']) {
  return renderNullable(value ? identityDocumentTypeLabels[value] ?? value : null);
}

export const offerColumns: ColumnsType<OfferListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '个人邮箱', dataIndex: 'personalEmail', width: 220, render: renderNullable },
  {
    title: '性别',
    dataIndex: 'gender',
    width: 90,
    render: renderGender,
  },
  { title: '录用部门', dataIndex: 'organizationName', width: 150, render: renderNullable },
  { title: '应聘职位', dataIndex: 'appliedPositionName', width: 150, render: renderNullable },
  { title: '预计入职日期', dataIndex: 'proposedEntryDate', width: 130, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 110, render: renderNullable },
  { title: '当前审批人', dataIndex: 'currentApproverName', width: 120, render: renderNullable },
  {
    title: '简历信息',
    dataIndex: 'resumeInfo',
    width: 110,
    render: (value: OfferListItem['resumeInfo']) => value === 'AVAILABLE' ? '已上传' : renderNullable(null),
  },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export const entryColumns: ColumnsType<OnboardingEntryListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '性别', dataIndex: 'gender', width: 90, render: renderGender },
  { title: '待入职部门', dataIndex: 'plannedOrganizationName', width: 150, render: renderNullable },
  { title: '计划入职日期', dataIndex: 'plannedEntryDate', width: 130, render: renderNullable },
  { title: '入职类型', dataIndex: 'entryType', width: 110, render: renderNullable },
  { title: '计划入职地点', dataIndex: 'plannedWorkplaceName', width: 150, render: renderNullable },
  { title: '职位', dataIndex: 'positionName', width: 150, render: renderNullable },
  { title: '职级', dataIndex: 'jobLevel', width: 110, render: renderNullable },
  { title: '直线经理', dataIndex: 'managerName', width: 120, render: renderNullable },
  { title: '入职状态', dataIndex: 'onboardingStatus', width: 110, render: renderOnboardingStatus },
  { title: '入职准备状态', dataIndex: 'preparationStatus', width: 130, render: renderNullable },
  { title: '信息采集状态', dataIndex: 'informationCollectionStatus', width: 130, render: renderNullable },
  { title: '入职材料状态', dataIndex: 'materialStatus', width: 130, render: renderNullable },
  { title: '雇佣关系', dataIndex: 'employmentRelationship', width: 120, render: renderNullable },
  { title: '全日制公司', dataIndex: 'fullTimeCompany', width: 150, render: renderNullable },
  { title: '合同类型', dataIndex: 'contractType', width: 150, render: renderAgreementType },
  { title: '生效日期', dataIndex: 'effectiveDate', width: 120, render: renderNullable },
  { title: '终止日期', dataIndex: 'terminationDate', width: 120, render: renderNullable },
  { title: '数据来源', dataIndex: 'dataSource', width: 120, render: renderNullable },
  { title: '当前审批人', dataIndex: 'currentApproverName', width: 120, render: renderNullable },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export const integrationColumns: ColumnsType<OnboardingIntegrationListItem> = [
  { title: '人员', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'organizationName', width: 150, render: renderNullable },
  { title: '职务', dataIndex: 'jobTitleName', width: 150, render: renderNullable },
  { title: '入职日期', dataIndex: 'entryDate', width: 120, render: renderNullable },
  { title: '直线经理', dataIndex: 'managerName', width: 120, render: renderNullable },
  { title: '融入状态', dataIndex: 'integrationStatus', width: 110, render: renderOnboardingStatus },
  {
    title: '融入进度',
    dataIndex: 'integrationProgress',
    width: 110,
    render: (value: OnboardingIntegrationListItem['integrationProgress']) => value === null ? '--' : `${value}%`,
  },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export const introductionColumns: ColumnsType<EmployeeIntroductionListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '性别', dataIndex: 'gender', width: 90, render: renderGender },
  { title: '部门', dataIndex: 'organizationName', width: 150, render: renderNullable },
  { title: '职位', dataIndex: 'positionName', width: 150, render: renderNullable },
  { title: '入职日期', dataIndex: 'entryDate', width: 120, render: renderNullable },
  { title: '入职介绍信息状态', dataIndex: 'introductionStatus', width: 160, render: renderOnboardingStatus },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];

export const idCardReadColumns: ColumnsType<IdCardReadListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, render: renderNullable },
  { title: '性别', dataIndex: 'gender', width: 90, render: renderGender },
  { title: '民族', dataIndex: 'ethnicity', width: 100, render: renderNullable },
  { title: '出生日期', dataIndex: 'birthDate', width: 120, render: renderNullable },
  { title: '户籍所在地', dataIndex: 'householdAddress', width: 220, render: renderNullable },
  { title: '证件类型', dataIndex: 'documentType', width: 150, render: renderIdentityDocumentType },
  { title: '证件号码', dataIndex: 'documentNumber', width: 180, render: renderNullable },
  { title: '签发机关', dataIndex: 'issuingAuthority', width: 180, render: renderNullable },
  { title: '证件开始日期', dataIndex: 'issueDate', width: 130, render: renderNullable },
  { title: '证件截止日期', dataIndex: 'expiryDate', width: 130, render: renderNullable },
  { title: '最后工作日', dataIndex: 'lastWorkingDate', width: 120, render: renderNullable },
  { title: '离职前部门', dataIndex: 'previousOrganizationName', width: 170, render: renderNullable },
  { title: '离职类型', dataIndex: 'terminationType', width: 130, render: renderNullable },
  { title: '离职原因', dataIndex: 'terminationReason', width: 200, ellipsis: true, render: renderNullable },
  {
    title: '照片',
    dataIndex: 'photo',
    width: 100,
    render: (value: IdCardReadListItem['photo']) => value === 'AVAILABLE' ? '已上传' : renderNullable(null),
  },
  { title: '录入人', dataIndex: 'recordedBy', width: 120, render: renderNullable },
  { title: '录入时间', dataIndex: 'recordedAt', width: 180, render: renderNullable },
  { title: '操作', key: 'actions', fixed: 'right', width: 110, render: renderUnavailableAction },
];
