import type { EmployeeRosterListItem } from '@hr-demo/shared';
import type { ColumnsType } from 'antd/es/table';
import { renderAgreementType } from '../../config/agreement-types';
import {
  educationLevelLabels,
  employmentRelationshipLabels,
  ethnicityLabels,
  householdTypeLabels,
  maritalStatusLabels,
  personnelCategoryLabels,
  politicalStatusLabels,
} from '../../config/personnel-fields';

export function displayRosterValue(value: unknown) {
  return value === null || value === undefined || value === '' ? '--' : String(value);
}

function renderMappedValue(value: unknown, labels: Record<string, string>) {
  if (value === null || value === undefined || value === '') return '--';
  const normalized = String(value);
  return labels[normalized] ?? normalized;
}

const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

const employmentStatusLabels: Record<string, string> = {
  PROBATION: '试用',
  REGULAR: '正式',
  PENDING_ENTRY: '待入职',
  TRANSFERRED_OUT: '调出',
  PENDING_TRANSFER_IN: '待调入',
  RETIRED: '退休',
  RESIGNED: '离职',
  NON_REGULAR: '非正式',
};

const contractTermTypeLabels: Record<string, string> = {
  FIXED: '固定期限',
  OPEN_ENDED: '无固定期限',
};

export const employeeRosterColumns: ColumnsType<EmployeeRosterListItem> = [
  { title: '姓名', dataIndex: 'name', width: 120, fixed: 'left', render: displayRosterValue },
  { title: '邮箱', dataIndex: 'workEmail', width: 210, fixed: 'left', render: displayRosterValue },
  { title: '工号', dataIndex: 'employeeNo', width: 120, fixed: 'left', render: displayRosterValue },
  { title: '性别', dataIndex: 'gender', width: 90, render: (value) => renderMappedValue(value, genderLabels) },
  { title: '出生日期', dataIndex: 'birthDate', width: 120, render: displayRosterValue },
  { title: '年龄', dataIndex: 'age', width: 80, render: displayRosterValue },
  { title: '最高学历', dataIndex: 'highestEducation', width: 120, render: (value) => renderMappedValue(value, educationLevelLabels) },
  { title: '毕业学校名称', dataIndex: 'graduationSchoolName', width: 180, render: displayRosterValue },
  { title: '毕业时间', dataIndex: 'graduationDate', width: 120, render: displayRosterValue },
  { title: '专业', dataIndex: 'major', width: 150, render: displayRosterValue },
  { title: '手机', dataIndex: 'mobile', width: 145, render: displayRosterValue },
  { title: '证件号码', dataIndex: 'documentNumber', width: 190, render: displayRosterValue },
  { title: '个人邮箱', dataIndex: 'personalEmail', width: 210, render: displayRosterValue },
  { title: '籍贯', dataIndex: 'nativePlace', width: 130, render: displayRosterValue },
  { title: '户籍所在地', dataIndex: 'householdAddress', width: 220, render: displayRosterValue },
  { title: '户口类别', dataIndex: 'householdType', width: 120, render: (value) => renderMappedValue(value, householdTypeLabels) },
  { title: '民族', dataIndex: 'ethnicity', width: 100, render: (value) => renderMappedValue(value, ethnicityLabels) },
  { title: '婚姻状况', dataIndex: 'maritalStatus', width: 110, render: (value) => renderMappedValue(value, maritalStatusLabels) },
  { title: '政治面貌', dataIndex: 'politicalStatus', width: 120, render: (value) => renderMappedValue(value, politicalStatusLabels) },
  { title: '入党/团日期', dataIndex: 'partyLeagueJoinDate', width: 130, render: displayRosterValue },
  { title: '参加工作日期', dataIndex: 'workStartDate', width: 130, render: displayRosterValue },
  { title: '紧急联系人', dataIndex: 'emergencyContactName', width: 130, render: displayRosterValue },
  { title: '与本人关系', dataIndex: 'emergencyContactRelationship', width: 150, render: displayRosterValue },
  { title: '紧急联系人电话', dataIndex: 'emergencyContactMobile', width: 155, render: displayRosterValue },
  { title: '入职日期', dataIndex: 'entryDate', width: 120, render: displayRosterValue },
  { title: '开始日期', dataIndex: 'assignmentStartDate', width: 130, render: displayRosterValue },
  { title: '结束日期', dataIndex: 'assignmentEndDate', width: 130, render: displayRosterValue },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: displayRosterValue },
  { title: '职务', dataIndex: 'jobTitleName', width: 130, render: displayRosterValue },
  { title: '职位', dataIndex: 'positionName', width: 130, render: displayRosterValue },
  { title: '职级', dataIndex: 'jobLevel', width: 110, render: displayRosterValue },
  { title: '直线经理', dataIndex: 'managerName', width: 120, render: displayRosterValue },
  { title: '直线经理邮箱', dataIndex: 'managerEmail', width: 210, render: displayRosterValue },
  { title: '人员类别', dataIndex: 'personnelCategory', width: 120, render: (value) => renderMappedValue(value, personnelCategoryLabels) },
  { title: '累计司龄（年）', dataIndex: 'serviceYears', width: 130, render: displayRosterValue },
  { title: '累计工龄（年）', dataIndex: 'workYears', width: 130, render: displayRosterValue },
  { title: '工作地点', dataIndex: 'workplaceName', width: 140, render: displayRosterValue },
  { title: '雇佣关系', dataIndex: 'employmentRelationship', width: 120, render: (value) => renderMappedValue(value, employmentRelationshipLabels) },
  { title: '人员状态', dataIndex: 'employmentStatus', width: 110, render: (value) => renderMappedValue(value, employmentStatusLabels) },
  { title: '是否有试用期', dataIndex: 'hasProbation', width: 125, render: (value) => value === true ? '是' : value === false ? '否' : '--' },
  { title: '试用开始日期', dataIndex: 'probationStartDate', width: 130, render: displayRosterValue },
  { title: '预计试用结束日期', dataIndex: 'probationPlannedEndDate', width: 145, render: displayRosterValue },
  { title: '试用期（月）', dataIndex: 'probationMonths', width: 120, render: displayRosterValue },
  { title: '转正日期', dataIndex: 'confirmedDate', width: 120, render: displayRosterValue },
  { title: '最后工作日', dataIndex: 'lastWorkingDate', width: 130, render: displayRosterValue },
  { title: '组织全称', dataIndex: 'organizationFullName', width: 240, render: displayRosterValue },
  { title: '一级组织', dataIndex: 'level1OrganizationName', width: 150, render: displayRosterValue },
  { title: '二级组织', dataIndex: 'level2OrganizationName', width: 150, render: displayRosterValue },
  { title: '三级组织', dataIndex: 'level3OrganizationName', width: 150, render: displayRosterValue },
  { title: '合同类型', dataIndex: 'agreementType', width: 170, render: renderAgreementType },
  { title: '全日制公司', dataIndex: 'fullTimeCompany', width: 180, render: displayRosterValue },
  { title: '合同期限类型', dataIndex: 'contractTermType', width: 140, render: (value) => renderMappedValue(value, contractTermTypeLabels) },
  { title: '合同生效日期', dataIndex: 'contractEffectiveDate', width: 135, render: displayRosterValue },
  { title: '合同终止日期', dataIndex: 'contractEndDate', width: 135, render: displayRosterValue },
  { title: '合同期限（月）', dataIndex: 'contractMonths', width: 135, render: displayRosterValue },
  { title: '实际终止时间', dataIndex: 'actualTerminationDate', width: 135, render: displayRosterValue },
];
