import type { ReactNode } from 'react';
import {
  CHINA_ADMINISTRATIVE_REGION_OPTIONS,
  getChinaAdministrativeRegionPath,
  matchesPositionCatalogEntry,
} from '@hr-demo/shared';
import {
  type BankName,
  type ContractTermType,
  type EducationLevel,
  type EmployeeLevel,
  type EmploymentRelationship,
  type Ethnicity,
  type HouseholdType,
  type InstitutionType,
  type MaritalStatus,
  type PersonnelCategory,
  type PersonnelPosition,
  type PersonnelSource,
  type PoliticalStatus,
  type WorkArrangement,
  type CreateEmployeeInput,
  type EmployeeFormOptions,
  type Gender,
  type IdentityDocumentType,
  type JobLevel,
  type Organization,
  type EmploymentStatus,
  type UpdateEmployeeInput,
} from '@hr-demo/shared';
import { Cascader, DatePicker, Form, Input, InputNumber, Radio, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { employmentStatusOptions } from './status';
import {
  bankNameOptions,
  educationLevelOptions,
  identityDocumentTypeOptions,
  employmentRelationshipOptions,
  ethnicityOptions,
  householdTypeOptions,
  institutionTypeOptions,
  maritalStatusOptions,
  personnelCategoryOptions,
  personnelPositionOptions,
  personnelSourceOptions,
  employeeLevelOptions,
  jobLevelOptions,
  politicalStatusOptions,
  workArrangementOptions,
} from '../../config/personnel-fields';

interface EmployeeFormValues {
  name: string;
  workEmail?: string;
  personalEmail?: string;
  documentType?: IdentityDocumentType;
  documentNumber?: string;
  documentExpiryDate?: Dayjs;
  idCardNo?: string;
  mobile: string;
  nationality?: string;
  workStartDate?: Dayjs;
  birthdayPreference?: 'SOLAR' | 'LUNAR';
  lunarBirthDate?: Dayjs;
  fullTimeDutyDescription?: string;
  partTimePositionName?: string;
  partTimeHourlyRate?: string;
  hasCompanyEquity?: boolean;
  gender?: Gender;
  personnelCategory?: PersonnelCategory;
  employmentRelationship?: EmploymentRelationship;
  personnelSource?: PersonnelSource;
  workArrangement?: WorkArrangement;
  birthDate?: Dayjs;
  nativePlace?: string;
  nativePlaceRegionCode?: string;
  ethnicity?: Ethnicity;
  maritalStatus?: MaritalStatus;
  politicalStatus?: PoliticalStatus;
  householdType?: HouseholdType;
  householdRegionCode?: string;
  householdAddress?: string;
  residentialRegionCode?: string;
  residentialAddress?: string;
  bankName?: BankName;
  bankBranchName?: string;
  bankAccountNumber?: string;
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactMobile?: string;
  personnelPosition?: PersonnelPosition;
  employeeLevel?: EmployeeLevel;
  agreementEmployingCompanyId?: string;
  graduationSchoolName?: string;
  institutionType?: InstitutionType;
  highestEducation?: EducationLevel;
  graduationDate?: Dayjs;
  major?: string;
  inviteAccount?: boolean;
  entryDate?: Dayjs;
  employeeNo: string;
  organizationId: string;
  positionId?: string;
  jobLevel?: JobLevel;
  isDepartmentLead?: boolean;
  workplaceName?: string;
  assignmentStartDate?: Dayjs;
  confirmationDate?: Dayjs;
  trialPostEndDate?: Dayjs;
  movementTypeId?: string;
  changeReason?: string;
  changeDescription?: string;
  hasProbation: boolean;
  probationMonths?: number;
  probationEndDate?: Dayjs;
  managerEmployeeId?: string;
  contractTermType?: ContractTermType;
  contractMonths?: number;
  contractEndDate?: Dayjs;
  employmentStatus: EmploymentStatus;
}

interface EmployeeFormProps {
  employee?: import('@hr-demo/shared').EmployeeDetail;
  organizations: Organization[];
  formOptions?: EmployeeFormOptions;
  onSubmit: (values: CreateEmployeeInput | UpdateEmployeeInput) => void;
  formId: string;
}

interface FormLineProps {
  name: keyof EmployeeFormValues;
  label: string;
  required?: boolean;
  note?: string;
  rules?: {
    required?: boolean;
    message?: string;
    max?: number;
    min?: number;
    pattern?: RegExp;
    type?: 'email' | 'number';
  }[];
  children: ReactNode;
  className?: string;
}

function FormLine({ name, label, required, note, rules, children, className }: FormLineProps) {
  return (
    <div className={`employee-form-line${className ? ` ${className}` : ''}`}>
      <span className="employee-form-label">{required ? <i>*</i> : null}{label}</span>
      <Form.Item<EmployeeFormValues>
        className="employee-form-control"
        name={name}
        rules={rules}
        extra={note}
      >
        {children}
      </Form.Item>
    </div>
  );
}

function FormSection({
  title,
  children,
  hideTitle = false,
}: {
  title: string;
  children: ReactNode;
  hideTitle?: boolean;
}) {
  return (
    <section className="employee-form-section">
      {hideTitle ? null : <h2>{title}</h2>}
      <div className="employee-form-grid">{children}</div>
    </section>
  );
}

export function matchesJobLevelSearch(
  input: string,
  option?: { label?: unknown; value?: unknown },
) {
  const keyword = input.trim().toLowerCase();
  if (!keyword) return true;
  return String(option?.label ?? option?.value ?? '').toLowerCase().includes(keyword);
}

export function matchesPositionSearch(
  input: string,
  option?: { code?: unknown; name?: unknown },
) {
  return matchesPositionCatalogEntry({
    code: String(option?.code ?? ''),
    name: String(option?.name ?? ''),
  }, input);
}

function regionPathValue(code: string | null | undefined): string[] | undefined {
  return getChinaAdministrativeRegionPath(code)?.codes;
}

function RegionCascader({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (value?: string) => void;
}) {
  return (
    <Cascader
      allowClear
      changeOnSelect
      options={CHINA_ADMINISTRATIVE_REGION_OPTIONS}
      placeholder="请选择省/市/区县"
      showSearch
      value={regionPathValue(value)}
      onChange={(codes) => onChange?.(codes.length ? String(codes.at(-1)) : undefined)}
    />
  );
}

export function EmployeeForm({
  employee,
  organizations,
  formOptions,
  onSubmit,
  formId,
}: EmployeeFormProps) {
  const [form] = Form.useForm<EmployeeFormValues>();
  const hasProbation = Form.useWatch('hasProbation', form);
  const contractTermType = Form.useWatch('contractTermType', form);
  const entryDate = Form.useWatch('entryDate', form);
  const positionOptions = (formOptions?.positions ?? [])
    .map(({ id, code, name }) => ({ value: id, label: `${code} - ${name}`, code, name }));
  const managerOptions = (formOptions?.managers ?? []).map(({ id, name, employeeNo }) => ({
    value: id,
    label: `${name}（${employeeNo}）`,
  }));
  const employingCompanyOptions = (formOptions?.employingCompanies ?? []).map(({ id, name }) => ({ value: id, label: name }));
  const movementTypeOptions = (formOptions?.movementTypes ?? []).map(({ id, name }) => ({ value: id, label: name }));

  useEffect(() => {
    if (employee) {
      const detail = employee;
      form.setFieldsValue({
        employeeNo: employee.employeeNo,
        name: employee.name ?? undefined,
        nationality: employee.nationality ?? undefined,
        workStartDate: employee.workStartDate ? dayjs(employee.workStartDate) : undefined,
        birthdayPreference: employee.birthdayPreference ?? undefined,
        lunarBirthDate: employee.lunarBirthDate ? dayjs(employee.lunarBirthDate) : undefined,
        fullTimeDutyDescription: employee.fullTimeDutyDescription ?? undefined,
        partTimePositionName: employee.partTimePositionName ?? undefined,
        partTimeHourlyRate: employee.partTimeHourlyRate ?? undefined,
        hasCompanyEquity: employee.hasCompanyEquity,
        workEmail: employee.workEmail ?? undefined,
        personalEmail: employee.personalEmail ?? undefined,
        mobile: employee.mobile ?? undefined,
        documentType: detail.documentType ?? undefined,
        documentNumber: detail.documentNumber ?? employee.idCardNo ?? undefined,
        organizationId: employee.organizationId ?? undefined,
        assignmentStartDate: employee.assignmentStartDate ? dayjs(employee.assignmentStartDate) : undefined,
        entryDate: employee.entryDate ? dayjs(employee.entryDate) : undefined,
        confirmationDate: employee.confirmationDate ? dayjs(employee.confirmationDate) : undefined,
        trialPostEndDate: employee.trialPostEndDate ? dayjs(employee.trialPostEndDate) : undefined,
        movementTypeId: employee.movementTypeId ?? undefined,
        changeReason: employee.changeReason ?? undefined,
        changeDescription: employee.changeDescription ?? undefined,
        managerEmployeeId: employee.managerEmployeeId ?? undefined,
        agreementEmployingCompanyId: employee.agreementEmployingCompanyId ?? undefined,
        positionId: detail.positionId ?? undefined,
        jobLevel: detail.jobLevel ?? undefined,
        workplaceName: detail.workplaceName ?? undefined,
        personnelPosition: detail.personnelPosition ?? undefined,
        employeeLevel: detail.employeeLevel ?? undefined,
        employmentStatus: employee.employmentStatus ?? undefined,
        personnelCategory: detail.personnelCategory ?? undefined,
        employmentRelationship: detail.employmentRelationship ?? undefined,
        personnelSource: detail.personnelSource ?? undefined,
        workArrangement: detail.workArrangement ?? undefined,
        birthDate: detail.birthDate ? dayjs(detail.birthDate) : undefined,
        ethnicity: detail.ethnicity as Ethnicity | undefined,
        maritalStatus: detail.maritalStatus as MaritalStatus | undefined,
        politicalStatus: detail.politicalStatus as PoliticalStatus | undefined,
        nativePlace: detail.nativePlace ?? undefined,
        nativePlaceRegionCode: detail.nativePlaceRegionCode ?? undefined,
        householdType: detail.householdType as HouseholdType | undefined,
        householdRegionCode: detail.householdRegionCode ?? undefined,
        householdAddress: detail.householdAddress ?? undefined,
        residentialRegionCode: detail.residentialRegionCode ?? undefined,
        residentialAddress: detail.residentialAddress ?? undefined,
        bankName: detail.bankName as BankName | undefined,
        bankBranchName: detail.bankBranchName ?? undefined,
        bankAccountNumber: detail.bankAccountNumber ?? undefined,
        documentExpiryDate: detail.documentExpiryDate ? dayjs(detail.documentExpiryDate) : undefined,
        emergencyContactName: detail.emergencyContactName ?? undefined,
        emergencyContactRelationship: detail.emergencyContactRelationship ?? undefined,
        emergencyContactMobile: detail.emergencyContactMobile ?? undefined,
        graduationSchoolName: detail.graduationSchoolName ?? undefined,
        institutionType: detail.institutionType as InstitutionType | undefined,
        highestEducation: detail.highestEducation as EducationLevel | undefined,
        graduationDate: detail.graduationDate ? dayjs(detail.graduationDate) : undefined,
        major: detail.major ?? undefined,
        hasProbation: false,
      });
    } else {
      form.setFieldsValue({
        documentType: 'NATIONAL_ID',
        employmentStatus: 'REGULAR',
        bankName: 'ICBC',
        documentExpiryDate: undefined,
        personnelCategory: 'NON_TALENT_PROGRAM',
        employmentRelationship: 'INTERNAL_EMPLOYEE',
        personnelSource: 'SOCIAL_RECRUITMENT',
        personnelPosition: 'FRONT_OFFICE',
        employeeLevel: 'STAFF',
        workArrangement: 'CONTRACT_EMPLOYMENT',
        hasProbation: true,
        isDepartmentLead: false,
        inviteAccount: true,
      });
    }
  }, [employee, form]);

  const suggestEndDate = (field: 'probationEndDate' | 'contractEndDate', months?: number) => {
    if (entryDate && months) form.setFieldValue(field, entryDate.add(months, 'month'));
  };

  const handleFinish = async (values: EmployeeFormValues) => {
    if (!employee) {
      const input: CreateEmployeeInput = {
        employeeNo: values.employeeNo,
        name: values.name,
        workEmail: values.workEmail!,
        // The creation dialog intentionally presents only the confirmed first-screen fields.
        // Remaining employee profile values use non-sensitive local Demo defaults until their
        // corresponding maintenance screens are available.
        personalEmail: values.workEmail!,
        gender: values.gender ?? 'UNDISCLOSED',
        personnelCategory: 'NON_TALENT_PROGRAM',
        employmentRelationship: 'INTERNAL_EMPLOYEE',
        personnelSource: 'SOCIAL_RECRUITMENT',
        workArrangement: values.workArrangement!,
        mobile: values.mobile,
        documentType: values.documentType!,
        documentNumber: values.documentNumber?.trim() || `PENDING-${values.employeeNo}`,
        documentExpiryDate: '2099-12-31',
        entryDate: values.entryDate!.format('YYYY-MM-DD'),
        organizationId: values.organizationId,
        positionId: values.positionId,
        jobLevel: values.jobLevel,
        workplaceName: values.workplaceName,
        personnelPosition: 'FRONT_OFFICE',
        employeeLevel: 'STAFF',
        agreementEmployingCompanyId: values.agreementEmployingCompanyId ?? employingCompanyOptions[0]?.value ?? '',
        householdType: 'NONLOCAL_URBAN',
        nativePlaceRegionCode: values.nativePlaceRegionCode,
        householdRegionCode: values.householdRegionCode,
        residentialRegionCode: values.residentialRegionCode,
        bankName: 'ICBC',
        bankBranchName: '本地 Demo 支行',
        bankAccountNumber: '0000000000000000001',
        birthDate: '1990-01-01',
        ethnicity: 'HAN',
        maritalStatus: 'UNMARRIED',
        politicalStatus: 'NON_PARTY',
        householdAddress: '待完善',
        residentialAddress: '待完善',
        emergencyContactName: '待完善',
        emergencyContactRelationship: '待完善',
        emergencyContactMobile: values.mobile,
        graduationSchoolName: '待完善',
        institutionType: 'NATIONAL_UNIFIED_BACHELOR',
        highestEducation: 'BACHELOR',
        graduationDate: '2012-07-01',
        major: '待完善',
        hasProbation: values.hasProbation,
        probationMonths: values.hasProbation ? values.probationMonths : undefined,
        probationEndDate: values.hasProbation ? values.probationEndDate?.format('YYYY-MM-DD') : undefined,
        managerEmployeeId: values.managerEmployeeId,
        contractTermType: values.contractTermType!,
        contractMonths: values.contractTermType === 'FIXED' ? values.contractMonths : undefined,
        contractEndDate: values.contractTermType === 'FIXED' ? values.contractEndDate?.format('YYYY-MM-DD') : undefined,
        employmentStatus: values.employmentStatus,
      };
      onSubmit(input);
      return;
    }

    const payload: UpdateEmployeeInput = {
      name: values.name,
      nationality: values.nationality?.trim(),
      workStartDate: values.workStartDate?.format('YYYY-MM-DD'),
      birthdayPreference: values.birthdayPreference,
      lunarBirthDate: values.lunarBirthDate?.format('YYYY-MM-DD'),
      fullTimeDutyDescription: values.fullTimeDutyDescription?.trim(),
      partTimePositionName: values.partTimePositionName?.trim(),
      partTimeHourlyRate: values.partTimeHourlyRate?.trim(),
      hasCompanyEquity: values.hasCompanyEquity,
      workEmail: values.workEmail?.trim(),
      personalEmail: values.personalEmail?.trim(),
      mobile: values.mobile?.trim(),
      gender: values.gender,
      birthDate: values.birthDate?.format('YYYY-MM-DD'),
      ethnicity: values.ethnicity,
      maritalStatus: values.maritalStatus,
      politicalStatus: values.politicalStatus,
      nativePlace: values.nativePlace?.trim(),
      nativePlaceRegionCode: values.nativePlaceRegionCode,
      householdType: values.householdType,
      householdRegionCode: values.householdRegionCode,
      householdAddress: values.householdAddress?.trim(),
      residentialRegionCode: values.residentialRegionCode,
      residentialAddress: values.residentialAddress?.trim(),
      bankName: values.bankName,
      bankBranchName: values.bankBranchName?.trim(),
      bankAccountNumber: values.bankAccountNumber?.trim(),
      ...(employee.primaryDocumentId || (values.documentType && values.documentNumber?.trim())
        ? {
          documentType: values.documentType,
          documentNumber: values.documentNumber?.trim(),
          documentExpiryDate: values.documentExpiryDate?.format('YYYY-MM-DD'),
        }
        : {}),
      emergencyContactName: values.emergencyContactName?.trim(),
      emergencyContactRelationship: values.emergencyContactRelationship?.trim(),
      emergencyContactMobile: values.emergencyContactMobile?.trim(),
      graduationSchoolName: values.graduationSchoolName?.trim(),
      institutionType: values.institutionType,
      highestEducation: values.highestEducation,
      graduationDate: values.graduationDate?.format('YYYY-MM-DD'),
      major: values.major?.trim(),
      ...(employee.assignmentId
        ? {
          ...(values.organizationId !== employee.organizationId ? { organizationId: values.organizationId } : {}),
          positionId: values.positionId,
          jobLevel: values.jobLevel,
          workplaceName: values.workplaceName,
          personnelPosition: values.personnelPosition,
          employeeLevel: values.employeeLevel,
          personnelCategory: values.personnelCategory,
          employmentRelationship: values.employmentRelationship,
          personnelSource: values.personnelSource,
          workArrangement: values.workArrangement,
          assignmentStartDate: values.assignmentStartDate?.format('YYYY-MM-DD'),
          entryDate: values.entryDate?.format('YYYY-MM-DD'),
          confirmationDate: values.confirmationDate?.format('YYYY-MM-DD'),
          trialPostEndDate: values.trialPostEndDate?.format('YYYY-MM-DD'),
          movementTypeId: values.movementTypeId,
          changeReason: values.changeReason?.trim(),
          changeDescription: values.changeDescription?.trim(),
          managerEmployeeId: values.managerEmployeeId,
          agreementEmployingCompanyId: values.agreementEmployingCompanyId,
        }
        : {
          initialEmployment: {
            organizationId: values.organizationId,
            entryDate: values.entryDate!.format('YYYY-MM-DD'),
            personnelCategory: values.personnelCategory,
            employmentRelationship: values.employmentRelationship!,
            personnelSource: values.personnelSource,
            workArrangement: values.workArrangement!,
            employmentStatus: values.employmentStatus,
            personnelPosition: values.personnelPosition,
            employeeLevel: values.employeeLevel,
            positionId: values.positionId,
            jobLevel: values.jobLevel,
            workplaceName: values.workplaceName,
          },
        }),
    };
    onSubmit(payload);
  };

  if (employee) {
    return (
      <Form<EmployeeFormValues> id={formId} form={form} requiredMark={false} onFinish={handleFinish} className="employee-form">
        <FormSection title="员工信息">
          <FormLine name="name" label="姓名" required rules={[{ required: true, message: '请输入姓名' }, { max: 50, message: '姓名不能超过 50 个字符' }]}><Input /></FormLine>
          <FormLine name="workEmail" label="电子邮件" required rules={[{ required: true, message: '请输入电子邮件' }, { type: 'email', message: '请输入有效的电子邮件' }]}><Input /></FormLine>
          <FormLine name="personalEmail" label="个人邮箱" rules={[{ type: 'email', message: '请输入有效的个人邮箱' }]}><Input /></FormLine>
          <FormLine name="workStartDate" label="参加工作日期"><DatePicker /></FormLine>
          <FormLine name="nationality" label="国籍(地区)"><Select options={[{ value: '中国', label: '中国' }]} /></FormLine>
          <FormLine name="documentType" label="证件类型" required rules={[{ required: true, message: '请选择证件类型' }]}><Select showSearch optionFilterProp="label" options={identityDocumentTypeOptions} /></FormLine>
          <FormLine name="documentNumber" label="证件号码" required rules={[{ required: true, message: '请输入证件号码' }, { max: 64, message: '证件号码不能超过 64 个字符' }]}><Input maxLength={64} /></FormLine>
          <FormLine name="birthDate" label="出生日期" required rules={[{ required: true, message: '请选择出生日期' }]}><DatePicker /></FormLine>
          <FormLine name="birthdayPreference" label="过生日偏好"><Select options={[{ value: 'SOLAR', label: '公历' }, { value: 'LUNAR', label: '农历' }]} /></FormLine>
          <FormLine name="lunarBirthDate" label="农历生日" required><DatePicker /></FormLine>
          <FormLine name="gender" label="性别" required><Select options={[{ value: 'MALE', label: '男' }, { value: 'FEMALE', label: '女' }, { value: 'UNDISCLOSED', label: '保密' }]} /></FormLine>
          <FormLine name="ethnicity" label="民族"><Select showSearch optionFilterProp="label" options={ethnicityOptions} /></FormLine>
          <FormLine name="maritalStatus" label="婚姻状况" required><Select options={maritalStatusOptions} /></FormLine>
          <FormLine name="politicalStatus" label="政治面貌" required><Select options={politicalStatusOptions} /></FormLine>
          <FormLine name="householdType" label="户口类别" required><Select options={householdTypeOptions} /></FormLine>
          <FormLine name="householdAddress" label="户籍所在地"><Input /></FormLine>
          <FormLine name="highestEducation" label="最高学历" required><Select options={educationLevelOptions} /></FormLine>
          <FormLine name="mobile" label="手机" required rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入 11 位中国大陆手机号' }]}><Input maxLength={11} /></FormLine>
          <FormLine name="residentialAddress" label="联系地址" required><Input /></FormLine>
          <FormLine name="emergencyContactName" label="紧急联系人" required><Input /></FormLine>
          <FormLine name="emergencyContactRelationship" label="与本人关系" required><Input /></FormLine>
          <FormLine name="emergencyContactMobile" label="紧急联系人电话" required><Input maxLength={11} /></FormLine>
          <FormLine name="fullTimeDutyDescription" label="全日制岗位职责说明" className="employee-form-tall-control"><Input.TextArea autoSize={false} /></FormLine>
          <FormLine name="partTimeHourlyRate" label="非全时薪资（元/小时）"><Input inputMode="decimal" /></FormLine>
          <FormLine name="partTimePositionName" label="非全职位名称"><Input /></FormLine>
        </FormSection>
        <FormSection title="任职信息">
          <FormLine name="assignmentStartDate" label="开始日期"><DatePicker /></FormLine>
          <FormLine name="agreementEmployingCompanyId" label="机构"><Select options={employingCompanyOptions} /></FormLine>
          <FormLine name="organizationId" label="部门" required rules={[{ required: true, message: '请选择部门' }]}><OrganizationTreeSelect organizations={organizations} placeholder="请选择" /></FormLine>
          <FormLine name="employmentRelationship" label="雇佣关系"><Select options={employmentRelationshipOptions} /></FormLine>
          <FormLine name="employeeNo" label="工号"><Input disabled /></FormLine>
          <FormLine name="positionId" label="职位"><Select placeholder="请搜索" showSearch filterOption={matchesPositionSearch} options={positionOptions} /></FormLine>
          <FormLine name="jobLevel" label="职级"><Select placeholder="请搜索" showSearch optionFilterProp="label" filterOption={matchesJobLevelSearch} options={jobLevelOptions} /></FormLine>
          <FormLine name="employeeLevel" label="员工层级"><Select options={employeeLevelOptions} /></FormLine>
          <FormLine name="personnelPosition" label="人员定位"><Select options={personnelPositionOptions} /></FormLine>
          <FormLine name="workplaceName" label="工作地点"><Input maxLength={191} /></FormLine>
          <FormLine name="managerEmployeeId" label="直接经理"><Select placeholder="请选择" showSearch optionFilterProp="label" options={managerOptions} /></FormLine>
          <FormLine name="personnelCategory" label="人员类别"><Select options={personnelCategoryOptions} /></FormLine>
          <FormLine name="workArrangement" label="用工形式"><Select options={workArrangementOptions} /></FormLine>
          <FormLine name="entryDate" label="入职日期"><DatePicker /></FormLine>
          <FormLine name="confirmationDate" label="转正日期"><DatePicker /></FormLine>
          <FormLine name="trialPostEndDate" label="试岗结束日期"><DatePicker /></FormLine>
          <FormLine name="movementTypeId" label="异动类型"><Select placeholder="请选择" options={movementTypeOptions} /></FormLine>
          <FormLine name="changeReason" label="变动原因"><Input /></FormLine>
          <FormLine name="changeDescription" label="变动说明"><Input /></FormLine>
          <FormLine name="hasCompanyEquity" label="是否有公司资质权限"><Radio.Group options={[{ value: true, label: '是' }, { value: false, label: '否' }]} /></FormLine>
        </FormSection>
        <FormSection title="银行卡信息">
          <FormLine name="bankName" label="银行" required><Select options={bankNameOptions} /></FormLine>
          <FormLine name="bankAccountNumber" label="银行账号" required><Input maxLength={19} /></FormLine>
          <FormLine name="bankBranchName" label="开户行支行" required><Input /></FormLine>
        </FormSection>
      </Form>
    );
  }

  return (
    <Form<EmployeeFormValues> id={formId} form={form} requiredMark={false} onFinish={handleFinish} className="employee-form">
      <FormSection title="员工信息" hideTitle>
        <FormLine name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }, { max: 50, message: '姓名不能超过 50 个字符' }]}><Input autoComplete="off" /></FormLine>
        <FormLine name="workEmail" label="电子邮件" required rules={[{ required: true, message: '请输入电子邮件' }, { type: 'email', message: '请输入有效的电子邮件' }]}><Input autoComplete="off" /></FormLine>
        <FormLine name="documentType" label="证件类型" rules={[{ required: true, message: '请选择证件类型' }]}><Select showSearch optionFilterProp="label" options={identityDocumentTypeOptions} /></FormLine>
        <FormLine name="documentNumber" label="证件号码" rules={[{ max: 64, message: '证件号码不能超过 64 个字符' }]}><Input maxLength={64} autoComplete="off" /></FormLine>
        <FormLine name="mobile" label="手机号码" rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入 11 位中国大陆手机号' }]}><Input inputMode="numeric" maxLength={11} autoComplete="off" /></FormLine>
        <FormLine name="gender" label="性别"><Select placeholder="请选择" options={[{ value: 'MALE', label: '男' }, { value: 'FEMALE', label: '女' }, { value: 'UNDISCLOSED', label: '保密' }]} /></FormLine>
        <FormLine name="nativePlaceRegionCode" label="籍贯地区"><RegionCascader /></FormLine>
        <FormLine name="householdRegionCode" label="户籍所在地地区"><RegionCascader /></FormLine>
        <FormLine name="residentialRegionCode" label="联系地址地区"><RegionCascader /></FormLine>
        <FormLine name="inviteAccount" label="邀请激活账号"><Radio.Group options={[{ value: true, label: '是' }, { value: false, label: '否' }]} /></FormLine>
      </FormSection>

      <FormSection title="任职信息">
        <FormLine name="entryDate" label="入职日期" required rules={[{ required: true, message: '请选择入职日期' }]}><DatePicker placeholder="入职日期" /></FormLine>
        <FormLine name="employeeNo" label="工号" rules={[{ required: true, message: '请输入工号' }, { max: 32, message: '工号不能超过 32 个字符' }, { pattern: /^[A-Za-z0-9_-]+$/, message: '只能使用字母、数字、下划线和连字符' }]}><Input autoComplete="off" /></FormLine>
        <FormLine name="organizationId" label="部门" required rules={[{ required: true, message: '请选择部门' }]}><OrganizationTreeSelect organizations={organizations} placeholder="请选择" /></FormLine>
        <FormLine name="positionId" label="职位"><Select placeholder="请搜索" showSearch filterOption={matchesPositionSearch} options={positionOptions} /></FormLine>
        <FormLine name="jobLevel" label="职级"><Select placeholder="请搜索" showSearch optionFilterProp="label" filterOption={matchesJobLevelSearch} options={jobLevelOptions} /></FormLine>
        <FormLine name="isDepartmentLead" label="是否部门负责人"><Radio.Group options={[{ value: true, label: '是' }, { value: false, label: '否' }]} /></FormLine>
        <FormLine name="workplaceName" label="工作地点"><Input placeholder="请输入（可选）" maxLength={191} /></FormLine>
        <FormLine name="workArrangement" label="用工形式" required rules={[{ required: true, message: '请选择用工形式' }]}><Select options={workArrangementOptions} /></FormLine>
        <FormLine name="hasProbation" label="是否有试用期" required rules={[{ required: true, message: '请选择是否有试用期' }]}><Select options={[{ value: true, label: '是' }, { value: false, label: '否' }]} onChange={(value) => { if (!value) form.setFieldsValue({ probationMonths: undefined, probationEndDate: undefined }); }} /></FormLine>
      </FormSection>

      <FormSection title="试用期信息">
        <FormLine name="probationMonths" label="试用期(月)" required={hasProbation} rules={hasProbation ? [{ required: true, message: '请输入试用期月数' }] : []}><InputNumber disabled={!hasProbation} placeholder="请选择" min={1} max={12} onChange={(value) => suggestEndDate('probationEndDate', value ?? undefined)} /></FormLine>
        <FormLine name="probationEndDate" label="预计试用结束日期" required={hasProbation} rules={hasProbation ? [{ required: true, message: '请选择预计试用结束日期' }] : []}><DatePicker disabled={!hasProbation} placeholder="预计试用结束日期" /></FormLine>
      </FormSection>

      <FormSection title="汇报关系">
        <FormLine name="managerEmployeeId" label="直接经理"><Select allowClear placeholder="请选择" showSearch optionFilterProp="label" options={managerOptions} /></FormLine>
      </FormSection>

      <FormSection title="合同协议">
        <FormLine name="agreementEmployingCompanyId" label="公司" rules={[{ required: true, message: '请选择公司' }]}><Select placeholder="请选择" showSearch optionFilterProp="label" options={employingCompanyOptions} /></FormLine>
        <FormLine name="contractTermType" label="期限类型" rules={[{ required: true, message: '请选择期限类型' }]}><Select placeholder="请选择" options={[{ value: 'FIXED', label: '固定期限' }, { value: 'OPEN_ENDED', label: '无固定期限' }]} onChange={(value) => { if (value !== 'FIXED') form.setFieldsValue({ contractMonths: undefined, contractEndDate: undefined }); }} /></FormLine>
        <FormLine name="contractMonths" label="合同期限(月)" required={contractTermType === 'FIXED'} rules={contractTermType === 'FIXED' ? [{ required: true, message: '请输入合同期限' }] : []}><InputNumber placeholder="请输入" min={1} max={120} onChange={(value) => suggestEndDate('contractEndDate', value ?? undefined)} /></FormLine>
        <FormLine name="contractEndDate" label="终止日期" required={contractTermType === 'FIXED'} rules={contractTermType === 'FIXED' ? [{ required: true, message: '请选择终止日期' }] : []}><DatePicker placeholder="终止日期" /></FormLine>
      </FormSection>
    </Form>
  );
}
