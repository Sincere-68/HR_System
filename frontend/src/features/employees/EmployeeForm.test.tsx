import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeDetail, EmployeeFormOptions } from '@hr-demo/shared';
import { buildOrganizationTreeData } from '../../components/OrganizationTreeSelect';
import {
  EmployeeForm,
  matchesJobLevelSearch,
  matchesPositionSearch,
} from './EmployeeForm';

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
  nativePlaceRegionCode: null,
  householdType: 'LOCAL_URBAN',
  householdRegionCode: null,
  householdAddress: '虚构户籍地址',
  residentialRegionCode: null,
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
  agreementEmployingCompanyId: 'company-1',
  primaryDocumentId: 'document-1',
  emergencyContactId: 'contact-1',
  highestEducationId: 'education-1',
  nationality: '中国',
  workStartDate: '2014-07-01',
  birthdayPreference: 'LUNAR',
  lunarBirthDate: '1992-02-15',
  fullTimeDutyDescription: '负责产品研发工作。',
  partTimePositionName: '技术顾问',
  partTimeHourlyRate: '200',
  hasCompanyEquity: false,
  assignmentStartDate: '2025-01-01',
  confirmationDate: null,
  trialPostEndDate: null,
  movementTypeId: null,
  movementTypeName: null,
  changeReason: null,
  changeDescription: null,
  managerEmployeeId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const organizations = [
  { id: 'org-company', code: 'COMPANY', name: '上海宜信电子商务有限公司', parentId: null },
  { id: 'org-ceo', code: 'CEO', name: 'CEO陈锐', parentId: 'org-company' },
  { id: 'org-1', code: 'SECOND', name: '二部', parentId: 'org-ceo' },
  { id: 'org-team', code: 'SECOND_TMALL', name: '二部天猫超市组', parentId: 'org-1' },
];
const formOptions: EmployeeFormOptions = {
  positions: [
    { id: 'position-1', code: '00105', name: 'web前端工程师', organizationId: null },
    { id: 'position-2', code: '00427', name: '开发工程师', organizationId: null },
  ],
  managers: [{ id: 'manager-1', name: '虚构经理甲', employeeNo: 'FAKE-M001' }],
  employingCompanies: [{ id: 'company-1', name: '虚构公司', code: 'COMPANY_001' }],
};

afterEach(() => cleanup());

describe('EmployeeForm', () => {
  it('matches job levels by code substring, including numeric suffixes', () => {
    expect(matchesJobLevelSearch('1', { label: 'S1', value: 'S1' })).toBe(true);
    expect(matchesJobLevelSearch('1', { label: 'E1', value: 'E1' })).toBe(true);
    expect(matchesJobLevelSearch('1', { label: 'T1', value: 'T1' })).toBe(true);
    expect(matchesJobLevelSearch('1', { label: 'M1', value: 'M1' })).toBe(true);
    expect(matchesJobLevelSearch('1', { label: 'S2', value: 'S2' })).toBe(false);
    expect(matchesJobLevelSearch('s', { label: 'S1', value: 'S1' })).toBe(true);
  });

  it('matches position options separately by position code and name', () => {
    const option = { code: '00105', name: 'web前端工程师' };
    expect(matchesPositionSearch('00105', option)).toBe(true);
    expect(matchesPositionSearch('前端工程师', option)).toBe(true);
    expect(matchesPositionSearch('开发工程师', option)).toBe(false);
  });

  it('uses the full confirmed identity-document list with Chinese labels', () => {
    render(
      <EmployeeForm
        formId="document-form"
        organizations={organizations}
        formOptions={formOptions}
        onSubmit={vi.fn()}
      />,
    );

    const documentTypeControl = screen.getAllByRole('combobox')
      .find((control) => control.getAttribute('id') === 'documentType')!;
    fireEvent.change(documentTypeControl, { target: { value: '新加坡亚籍（EP）' } });
    expect(screen.getByRole('option', { name: '新加坡亚籍（EP）' })).toBeInTheDocument();
    fireEvent.change(documentTypeControl, { target: { value: '马来西亚技工培训准证' } });
    expect(screen.getByRole('option', { name: '马来西亚技工培训准证' })).toBeInTheDocument();
    fireEvent.change(documentTypeControl, { target: { value: '香港特别行政区签证身份书（黄本）' } });
    expect(screen.getByRole('option', { name: '香港特别行政区签证身份书（黄本）' })).toBeInTheDocument();
  });

  it('renders the target employee fields and keeps the employee number read-only', async () => {
    render(
      <EmployeeForm
        formId="region-form"
        employee={employee}
        organizations={organizations}
        formOptions={formOptions}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('参加工作日期')).toBeInTheDocument();
    expect(screen.getByText('全日制岗位职责说明')).toBeInTheDocument();
    expect(screen.getByText('银行卡信息')).toBeInTheDocument();
    expect(document.getElementById('employeeNo')).toBeDisabled();
  });

  it('builds a nested organization tree from parent identifiers', () => {
    expect(buildOrganizationTreeData(organizations)).toEqual([{
      key: 'org-company',
      value: 'org-company',
      title: '上海宜信电子商务有限公司',
      children: [{
        key: 'org-ceo',
        value: 'org-ceo',
        title: 'CEO陈锐',
        children: [{
          key: 'org-1',
          value: 'org-1',
          title: '二部',
          children: [{
            key: 'org-team',
            value: 'org-team',
            title: '二部天猫超市组',
          }],
        }],
      }],
    }]);
  });

  it('keeps globally selectable positions available when the department changes', () => {
    render(
      <EmployeeForm
        formId="position-form"
        organizations={organizations}
        formOptions={formOptions}
        onSubmit={vi.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getAllByRole('combobox').find((control) => control.getAttribute('id') === 'positionId')!);
    expect(screen.getByText('00105 - web前端工程师')).toBeInTheDocument();
    expect(screen.getByText('00427 - 开发工程师')).toBeInTheDocument();
  });

  it('renders the confirmed employee creation fields in their sections', () => {
    render(
      <EmployeeForm
        formId="create-form"
        organizations={organizations}
        formOptions={formOptions}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      '任职信息', '试用期信息', '汇报关系', '合同协议',
    ]);
    const labels = [...document.querySelectorAll('.employee-form-label')].map((label) => label.textContent?.replace('*', ''));
    expect(labels).toEqual(expect.arrayContaining([
      '姓名', '电子邮件', '证件类型', '证件号码', '手机号码', '性别', '籍贯地区', '户籍所在地地区', '联系地址地区', '邀请激活账号',
      '入职日期', '工号', '部门', '职位', '职级', '是否部门负责人', '工作地点', '用工形式',
      '是否有试用期', '试用期(月)', '预计试用结束日期', '直接经理', '公司', '期限类型',
      '合同期限(月)', '终止日期',
    ]));
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);
    const sections = [...document.querySelectorAll('.employee-form-section')];
    const assignmentSection = sections.find((section) => section.querySelector('h2')?.textContent === '任职信息')!;
    const agreementSection = sections.find((section) => section.querySelector('h2')?.textContent === '合同协议')!;
    expect(assignmentSection.textContent).not.toContain('公司');
    expect(agreementSection.textContent).toContain('公司');
  });

  it('requires the department when a partial employee is saved', async () => {
    const onSubmit = vi.fn();
    render(
      <EmployeeForm
        formId="partial-required-form"
        employee={{ ...employee, assignmentId: null, organizationId: '' }}
        organizations={organizations}
        formOptions={formOptions}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.submit(document.getElementById('partial-required-form')!);

    expect(await screen.findByText('请选择部门')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows position, job level, and workplace for an existing employment record', async () => {
    render(
      <EmployeeForm
        formId="existing-assignment-form"
        employee={employee}
        organizations={organizations}
        formOptions={formOptions}
        onSubmit={vi.fn()}
      />,
    );

    const labels = [...document.querySelectorAll('.employee-form-label')].map((label) => label.textContent?.replace('*', ''));
    expect(labels).toEqual(expect.arrayContaining(['职位', '职级', '工作地点']));
    expect(document.getElementById('positionId')).toBeInTheDocument();
    expect(document.getElementById('jobLevel')).toBeInTheDocument();
    expect(document.getElementById('workplaceName')).toBeInTheDocument();
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
    const departmentControl = screen.getAllByRole('combobox')
      .find((control) => control.getAttribute('id') === 'organizationId')!;
    expect(departmentControl).not.toBeDisabled();
    fireEvent.mouseDown(departmentControl);
    expect(screen.getByText('上海宜信电子商务有限公司')).toBeInTheDocument();
    expect(screen.queryByText('组织架构')).not.toBeInTheDocument();
    expect(screen.queryByText('CEO陈锐')).not.toBeInTheDocument();
  });
});
