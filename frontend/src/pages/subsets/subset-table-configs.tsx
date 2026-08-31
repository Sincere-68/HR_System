import type {
  AppraisalListItem,
  AwardListItem,
  CertificateListItem,
  EducationListItem,
  FamilyListItem,
  LanguageListItem,
  ProjectListItem,
  SkillListItem,
  TrainingListItem,
  WorkHistoryListItem,
} from '@hr-demo/shared';
import type { ColumnsType } from 'antd/es/table';
import { renderEmployeeDetailAction, renderNullable } from './SubsetsListPage';

export const educationColumns: ColumnsType<EducationListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '开始日期', dataIndex: 'startDate', width: 120, render: renderNullable },
  { title: '结束日期', dataIndex: 'endDate', width: 120, render: renderNullable },
  { title: '毕业学校名称', dataIndex: 'schoolName', width: 200, render: renderNullable },
  { title: '毕业学校类型', dataIndex: 'schoolType', width: 140, render: renderNullable },
  { title: '专业', dataIndex: 'major', width: 160, render: renderNullable },
  { title: '学历', dataIndex: 'educationLevel', width: 120, render: renderNullable },
  { title: '学位', dataIndex: 'degree', width: 120, render: renderNullable },
  {
    title: '是否最高学历',
    dataIndex: 'isHighestEducation',
    width: 130,
    render: (value: boolean) => (value ? '是' : '否'),
  },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];

export const workHistoryColumns: ColumnsType<WorkHistoryListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '当前任职部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '单位名称', dataIndex: 'companyName', width: 200, render: renderNullable },
  { title: '职务', dataIndex: 'jobTitleName', width: 140, render: renderNullable },
  { title: '开始日期', dataIndex: 'startDate', width: 120, render: renderNullable },
  { title: '结束日期', dataIndex: 'endDate', width: 120, render: renderNullable },
  { title: '证明人', dataIndex: 'referenceName', width: 140, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];
const genderLabels: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  UNDISCLOSED: '保密',
};

export const familyColumns: ColumnsType<FamilyListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '成员姓名', dataIndex: 'memberName', width: 140, render: renderNullable },
  { title: '与本人关系名称', dataIndex: 'relationshipName', width: 150, render: renderNullable },
  {
    title: '性别',
    dataIndex: 'gender',
    width: 100,
    render: (value: string | null) => (value ? (genderLabels[value] ?? value) : '--'),
  },
  { title: '手机号码', dataIndex: 'mobile', width: 150, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];

export const appraisalColumns: ColumnsType<AppraisalListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '考核年度', dataIndex: 'appraisalYear', width: 120, render: renderNullable },
  { title: '周期名称', dataIndex: 'periodName', width: 160, render: renderNullable },
  { title: '绩效活动', dataIndex: 'performanceActivity', width: 180, render: renderNullable },
  { title: '考核部门', dataIndex: 'appraisalDepartment', width: 150, render: renderNullable },
  { title: '最终得分', dataIndex: 'finalScore', width: 120, render: renderNullable },
  { title: '起始日期', dataIndex: 'startDate', width: 120, render: renderNullable },
  { title: '截止日期', dataIndex: 'endDate', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];
export const trainingColumns: ColumnsType<TrainingListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '开始日期', dataIndex: 'startDate', width: 120, render: renderNullable },
  { title: '结束日期', dataIndex: 'endDate', width: 120, render: renderNullable },
  { title: '名称', dataIndex: 'trainingName', width: 200, render: renderNullable },
  { title: '培训机构', dataIndex: 'trainingProvider', width: 180, render: renderNullable },
  { title: '培训成绩', dataIndex: 'trainingResult', width: 140, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: renderNullable },
  { title: '获得学分', dataIndex: 'credits', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];

export const awardColumns: ColumnsType<AwardListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '获奖日期', dataIndex: 'awardDate', width: 120, render: renderNullable },
  { title: '奖项', dataIndex: 'awardName', width: 180, render: renderNullable },
  { title: '简述', dataIndex: 'summary', width: 240, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];
export const certificateColumns: ColumnsType<CertificateListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '证书名称', dataIndex: 'certificateName', width: 200, render: renderNullable },
  { title: '证书编号', dataIndex: 'certificateNo', width: 180, render: renderNullable },
  { title: '发证机构', dataIndex: 'issuingAuthority', width: 180, render: renderNullable },
  { title: '获得时间', dataIndex: 'issueDate', width: 120, render: renderNullable },
  { title: '有效期至', dataIndex: 'expiryDate', width: 120, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];

export const projectColumns: ColumnsType<ProjectListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '开始日期', dataIndex: 'startDate', width: 120, render: renderNullable },
  { title: '结束日期', dataIndex: 'endDate', width: 120, render: renderNullable },
  { title: '项目名称', dataIndex: 'projectName', width: 200, render: renderNullable },
  { title: '职务', dataIndex: 'projectRole', width: 140, render: renderNullable },
  { title: '描述', dataIndex: 'description', width: 260, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];
export const skillColumns: ColumnsType<SkillListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '技能名称', dataIndex: 'skillName', width: 180, render: renderNullable },
  { title: '掌握程度', dataIndex: 'proficiencyLevel', width: 140, render: renderNullable },
  { title: '种类', dataIndex: 'skillCategory', width: 140, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];

export const languageColumns: ColumnsType<LanguageListItem> = [
  { title: '姓名', dataIndex: 'employeeName', width: 120, render: renderNullable },
  { title: '邮箱', dataIndex: 'workEmail', width: 220, render: renderNullable },
  { title: '工号', dataIndex: 'employeeNo', width: 120, render: renderNullable },
  { title: '部门', dataIndex: 'departmentName', width: 150, render: renderNullable },
  { title: '语言', dataIndex: 'language', width: 140, render: renderNullable },
  {
    title: '是否母语',
    dataIndex: 'nativeLanguage',
    width: 120,
    render: (value: boolean | null) => (value === null ? '--' : value ? '是' : '否'),
  },
  { title: '掌握程度', dataIndex: 'proficiencyLevel', width: 140, render: renderNullable },
  { title: '书写能力', dataIndex: 'writingLevel', width: 140, render: renderNullable },
  { title: '阅读能力', dataIndex: 'readingLevel', width: 140, render: renderNullable },
  { title: '口语能力', dataIndex: 'speakingLevel', width: 140, render: renderNullable },
  { title: '审批状态', dataIndex: 'approvalStatus', width: 120, render: renderNullable },
  {
    title: '操作',
    key: 'actions',
    fixed: 'right',
    width: 100,
    render: (_, record) => renderEmployeeDetailAction(record.employeeId, record.canViewEmployeeDetail),
  },
];
