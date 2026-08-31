import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail, EmployeeFormOptions } from '@hr-demo/shared';
import { EmployeeForm, matchesJobLevelSearch } from './EmployeeForm';

const employee: EmployeeDetail = {
  id: 'employee-1',
  employeeNo: 'DEMO-1001',
  name: '林知夏',
  mobile: '13800001001',
  idCardNo: '110101199203181021',
  organizationId: 'org-1',
  organizationName: '产品研发部',
  employmentStatus: 'REGULAR',
  entryDate: '2025-01-01',
  positionName: '软件工程师',
  gender: 'FEMALE',
  personnelPosition: 'FRONT_OFFICE',
  jobLevel: 'S1',
  employeeLevel: 'STAFF',
  workplaceName: '虚构园区',
  workEmail: 'fictional.employee@example.invalid',
  personalEmail: 'fictional.personal@example.invalid',
  personnelCategory: 'NON_TALENT_PROGRAM',
  personnelSource: 'SOCIAL_RECRUITMENT',
  fullTimeCompany: '虚构公司',
  employmentRelationship: 'INTERNAL_EMPLOYEE',
  workArrangement: 'CONTRACT_EMPLOYMENT',
  managerName: null,
  managerEmail: null,
  totalWorkYears: null,
  totalServiceYears: 1,
  documentType: 'NATIONAL_ID',
  documentNumber: '110101199203181021',
  documentExpiryDate: '2036-01-01',
  birthDate: '1992-03-18',
  age: 34,
  ethnicity: 'HAN',
  maritalStatus: 'UNMARRIED',
  politicalStatus: 'NON_PARTY',
  nativePlace: '虚构籍贯',
  householdType: 'LOCAL_URBAN',
  householdAddress: '虚构户籍地址',
  residentialAddress: '虚构联系地址',
  emergencyContactName: '虚构联系人',
  emergencyContactRelationship: '家属',
  emergencyContactMobile: '13900002002',
  bankName: 'ICBC',
  bankBranchName: '虚构支行',
  bankAccountNumber: '6222000000000000001',
  graduationSchoolName: '虚构大学',
  institutionType: 'RANK_985',
  highestEducation: 'BACHELOR',
  graduationDate: '2014-06-30',
  major: '虚构专业',
  assignmentId: 'assignment-1',
  positionId: 'position-1',
  workplaceId: 'workplace-1',
  agreementEmployingCompanyId: 'company-1',
  primaryDocumentId: 'document-1',
  emergencyContactId: 'contact-1',
  highestEducationId: 'education-1',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const organizations = [{ id: 'org-1', code: 'PRODUCT', name: '产品研发部', parentId: null }];
const formOptions: EmployeeFormOptions = {
  positions: [{ id: 'position-1', name: '软件工程师', organizationId: 'org-1' }],
  workplaces: [{ id: 'workplace-1', name: '虚构园区' }],
  managers: [{ id: 'manager-1', name: '虚构经理甲', employeeNo: 'FAKE-M001' }],
  employingCompanies: [{ id: 'company-1', name: '虚构公司', code: 'COMPANY_001' }],
};

describe('EmployeeForm', () => {
  it('matches job levels by code substring, including numeric suffixes', () => {
    expect(matchesJobLevelSearch('1', { label: 'S1', value: 'S1' })).toBe(true);
    expect(matchesJobLevelSearch('1', { label: 'E1', value: 'E1' })).toBe(true);
    expect(matchesJobLevelSearch('1', { label: 'T1', value: 'T1' })).toBe(true);
    expect(matchesJobLevelSearch('1', { label: 'M1', value: 'M1' })).toBe(true);
    expect(matchesJobLevelSearch('1', { label: 'S2', value: 'S2' })).toBe(false);
    expect(matchesJobLevelSearch('s', { label: 'S1', value: 'S1' })).toBe(true);
  });

  it('renders all required personnel creation fields in their sections', () => {
    render(
      <EmployeeForm
        formId="create-form"
        organizations={organizations}
        formOptions={formOptions}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      '员工信息', '任职信息', '紧急联系人', '银行资料', '教育经历', '试用期信息', '汇报关系', '合同协议',
    ]);
    const labels = [...document.querySelectorAll('.employee-form-label')].map((label) => label.textContent?.replace('*', ''));
    expect(labels).toEqual(expect.arrayContaining([
      '姓名', '企业邮箱', '个人邮箱', '手机号码', '性别', '出生日期', '民族', '婚姻状况',
      '政治面貌', '籍贯', '户口类别', '户籍所在地', '联系地址', '证件类型', '证件号码',
      '证件截止日期', '入职日期', '工号', '部门', '人员定位', '员工层级', '人员类别',
      '雇佣关系', '人员来源', '用工形式', '全日制公司', '紧急联系人', '与本人关系',
      '紧急联系人电话', '银行', '开户行支行', '银行账号', '毕业学校名称', '院校类型',
      '最高学历', '毕业时间', '专业',
    ]));
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
    const sections = [...document.querySelectorAll('.employee-form-section')];
    const assignmentSection = sections.find((section) => section.querySelector('h2')?.textContent === '任职信息')!;
    const agreementSection = sections.find((section) => section.querySelector('h2')?.textContent === '合同协议')!;
    expect(assignmentSection.textContent).not.toContain('全日制公司');
    expect(agreementSection.textContent).toContain('全日制公司');
  });

  it('fills complete employee values into editable inputs', async () => {
    render(
      <EmployeeForm
        formId="test-form"
        employee={employee}
        organizations={organizations}
        onSubmit={vi.fn()}
      />,
    );
    expect(await screen.findByDisplayValue('DEMO-1001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('13800001001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('110101199203181021')).toBeInTheDocument();
    expect(screen.getByText('前台')).toBeInTheDocument();
    expect(screen.getByText('员工级')).toBeInTheDocument();
  });
});
