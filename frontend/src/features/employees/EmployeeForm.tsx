import type { ReactNode } from 'react';
import {
  IDENTITY_DOCUMENT_TYPES,
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
import { DatePicker, Form, Input, InputNumber, Radio, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect } from 'react';
import { employmentStatusOptions } from './status';
import {
  bankNameOptions,
  educationLevelOptions,
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
  gender?: Gender;
  personnelCategory?: PersonnelCategory;
  employmentRelationship?: EmploymentRelationship;
  personnelSource?: PersonnelSource;
  workArrangement?: WorkArrangement;
  birthDate?: Dayjs;
  nativePlace?: string;
  ethnicity?: Ethnicity;
  maritalStatus?: MaritalStatus;
  politicalStatus?: PoliticalStatus;
  householdType?: HouseholdType;
  householdAddress?: string;
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
  workplaceId?: string;
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
}

const identityDocumentTypeLabels: Record<IdentityDocumentType, string> = {
  NATIONAL_ID: '居民身份证',
  PASSPORT: '护照',
  HK_MACAO_PERMIT: '港澳通行证',
  TAIWAN_PERMIT: '台湾通行证',
  RESIDENCE_PERMIT: '居住证',
  OTHER: '其他证件',
};

function FormLine({ name, label, required, note, rules, children }: FormLineProps) {
  return (
    <div className="employee-form-line">
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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="employee-form-section">
      <h2>{title}</h2>
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

export function EmployeeForm({
  employee,
  organizations,
  formOptions,
  onSubmit,
  formId,
}: EmployeeFormProps) {
  const [form] = Form.useForm<EmployeeFormValues>();
  const selectedOrganizationId = Form.useWatch('organizationId', form);
  const hasProbation = Form.useWatch('hasProbation', form);
  const contractTermType = Form.useWatch('contractTermType', form);
  const entryDate = Form.useWatch('entryDate', form);
  const organizationOptions = organizations.map(({ id, name }) => ({ value: id, label: name }));
  const positionOptions = (formOptions?.positions ?? [])
    .filter((position) => !position.organizationId || position.organizationId === selectedOrganizationId)
    .map(({ id, name }) => ({ value: id, label: name }));
  const workplaceOptions = (formOptions?.workplaces ?? []).map(({ id, name }) => ({ value: id, label: name }));
  const managerOptions = (formOptions?.managers ?? []).map(({ id, name, employeeNo }) => ({
    value: id,
    label: `${name}（${employeeNo}）`,
  }));
  const employingCompanyOptions = (formOptions?.employingCompanies ?? []).map(({ id, name }) => ({ value: id, label: name }));

  useEffect(() => {
    if (employee) {
      const detail = employee;
      form.setFieldsValue({
        employeeNo: employee.employeeNo,
        name: employee.name,
        workEmail: employee.workEmail ?? undefined,
        personalEmail: employee.personalEmail ?? undefined,
        mobile: employee.mobile,
        documentType: detail.documentType ?? 'NATIONAL_ID',
        documentNumber: detail.documentNumber ?? employee.idCardNo ?? undefined,
        organizationId: employee.organizationId,
        positionId: detail.positionId ?? undefined,
        jobLevel: detail.jobLevel ?? undefined,
        workplaceId: detail.workplaceId ?? undefined,
        personnelPosition: detail.personnelPosition ?? undefined,
        employeeLevel: detail.employeeLevel ?? undefined,
        employmentStatus: employee.employmentStatus,
        personnelCategory: detail.personnelCategory ?? undefined,
        employmentRelationship: detail.employmentRelationship ?? undefined,
        personnelSource: detail.personnelSource ?? undefined,
        workArrangement: detail.workArrangement ?? undefined,
        birthDate: detail.birthDate ? dayjs(detail.birthDate) : undefined,
        ethnicity: detail.ethnicity as Ethnicity | undefined,
        maritalStatus: detail.maritalStatus as MaritalStatus | undefined,
        politicalStatus: detail.politicalStatus as PoliticalStatus | undefined,
        nativePlace: detail.nativePlace ?? undefined,
        householdType: detail.householdType as HouseholdType | undefined,
        householdAddress: detail.householdAddress ?? undefined,
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
        hasProbation: true,
      });
    }
  }, [employee, form]);

  const suggestEndDate = (field: 'probationEndDate' | 'contractEndDate', months?: number) => {
    if (entryDate && months) form.setFieldValue(field, entryDate.add(months, 'month'));
  };

  const handleFinish = (values: EmployeeFormValues) => {
    if (!employee) {
      const input: CreateEmployeeInput = {
        employeeNo: values.employeeNo,
        name: values.name,
        workEmail: values.workEmail!,
        personalEmail: values.personalEmail!,
        gender: values.gender!,
        personnelCategory: values.personnelCategory!,
        employmentRelationship: values.employmentRelationship!,
        personnelSource: values.personnelSource!,
        workArrangement: values.workArrangement!,
        mobile: values.mobile,
        documentType: values.documentType!,
        documentNumber: values.documentNumber!,
        documentExpiryDate: values.documentExpiryDate!.format('YYYY-MM-DD'),
        entryDate: values.entryDate!.format('YYYY-MM-DD'),
        organizationId: values.organizationId,
        positionId: values.positionId,
        jobLevel: values.jobLevel,
        workplaceId: values.workplaceId,
        personnelPosition: values.personnelPosition!,
        employeeLevel: values.employeeLevel!,
        agreementEmployingCompanyId: values.agreementEmployingCompanyId!,
        householdType: values.householdType!,
        bankName: values.bankName!,
        bankBranchName: values.bankBranchName!,
        bankAccountNumber: values.bankAccountNumber!,
        birthDate: values.birthDate!.format('YYYY-MM-DD'),
        ethnicity: values.ethnicity!,
        maritalStatus: values.maritalStatus!,
        politicalStatus: values.politicalStatus!,
        householdAddress: values.householdAddress!,
        residentialAddress: values.residentialAddress!,
        emergencyContactName: values.emergencyContactName!,
        emergencyContactRelationship: values.emergencyContactRelationship!,
        emergencyContactMobile: values.emergencyContactMobile!,
        graduationSchoolName: values.graduationSchoolName!,
        institutionType: values.institutionType!,
        highestEducation: values.highestEducation!,
        graduationDate: values.graduationDate!.format('YYYY-MM-DD'),
        major: values.major!,
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
      employeeNo: values.employeeNo,
      name: values.name,
      workEmail: values.workEmail?.trim(),
      personalEmail: values.personalEmail?.trim(),
      mobile: values.mobile?.trim(),
      gender: values.gender,
      birthDate: values.birthDate?.format('YYYY-MM-DD'),
      ethnicity: values.ethnicity,
      maritalStatus: values.maritalStatus,
      politicalStatus: values.politicalStatus,
      nativePlace: values.nativePlace?.trim(),
      householdType: values.householdType,
      householdAddress: values.householdAddress?.trim(),
      residentialAddress: values.residentialAddress?.trim(),
      bankName: values.bankName,
      bankBranchName: values.bankBranchName?.trim(),
      bankAccountNumber: values.bankAccountNumber?.trim(),
      documentType: values.documentType,
      documentNumber: values.documentNumber?.trim(),
      documentExpiryDate: values.documentExpiryDate?.format('YYYY-MM-DD'),
      emergencyContactName: values.emergencyContactName?.trim(),
      emergencyContactRelationship: values.emergencyContactRelationship?.trim(),
      emergencyContactMobile: values.emergencyContactMobile?.trim(),
      graduationSchoolName: values.graduationSchoolName?.trim(),
      institutionType: values.institutionType,
      highestEducation: values.highestEducation,
      graduationDate: values.graduationDate?.format('YYYY-MM-DD'),
      major: values.major?.trim(),
      personnelPosition: values.personnelPosition,
      employeeLevel: values.employeeLevel,
      personnelCategory: values.personnelCategory,
      employmentRelationship: values.employmentRelationship,
      personnelSource: values.personnelSource,
      workArrangement: values.workArrangement,
    };
    onSubmit(payload);
  };

  if (employee) {
    return (
      <Form<EmployeeFormValues> id={formId} form={form} requiredMark={false} onFinish={handleFinish} className="employee-form">
        <FormSection title="员工信息">
          <FormLine name="name" label="姓名" required rules={[{ required: true, message: '请输入姓名' }, { max: 50, message: '姓名不能超过 50 个字符' }]}><Input /></FormLine>
          <FormLine name="employeeNo" label="工号" required rules={[{ required: true, message: '请输入工号' }, { max: 32, message: '工号不能超过 32 个字符' }, { pattern: /^[A-Za-z0-9_-]+$/, message: '只能使用字母、数字、下划线和连字符' }]}><Input /></FormLine>
          <FormLine name="workEmail" label="企业邮箱" rules={[{ type: 'email', message: '请输入有效的企业邮箱' }]}><Input /></FormLine>
          <FormLine name="personalEmail" label="个人邮箱" rules={[{ type: 'email', message: '请输入有效的个人邮箱' }]}><Input /></FormLine>
          <FormLine name="mobile" label="手机号码" rules={[{ pattern: /^1\d{10}$/, message: '请输入 11 位中国大陆手机号' }]}><Input maxLength={11} /></FormLine>
          <FormLine name="gender" label="性别"><Select options={[{ value: 'MALE', label: '男' }, { value: 'FEMALE', label: '女' }, { value: 'UNDISCLOSED', label: '保密' }]} /></FormLine>
          <FormLine name="birthDate" label="出生日期"><DatePicker /></FormLine>
          <FormLine name="ethnicity" label="民族"><Select showSearch optionFilterProp="label" options={ethnicityOptions} /></FormLine>
          <FormLine name="maritalStatus" label="婚姻状况"><Select options={maritalStatusOptions} /></FormLine>
          <FormLine name="politicalStatus" label="政治面貌"><Select options={politicalStatusOptions} /></FormLine>
          <FormLine name="nativePlace" label="籍贯"><Input /></FormLine>
          <FormLine name="householdType" label="户口类别"><Select options={householdTypeOptions} /></FormLine>
          <FormLine name="householdAddress" label="户籍所在地"><Input /></FormLine>
          <FormLine name="residentialAddress" label="联系地址"><Input /></FormLine>
          <FormLine name="documentType" label="证件类型"><Select options={IDENTITY_DOCUMENT_TYPES.map((value) => ({ value, label: identityDocumentTypeLabels[value] }))} /></FormLine>
          <FormLine name="documentNumber" label="证件号码"><Input maxLength={64} /></FormLine>
          <FormLine name="documentExpiryDate" label="证件截止日期"><DatePicker /></FormLine>
        </FormSection>
        <FormSection title="任职信息">
          <FormLine name="organizationId" label="部门" note="部门异动需通过任职异动流程保留历史"><Select disabled options={organizationOptions} /></FormLine>
          <FormLine name="personnelPosition" label="人员定位"><Select options={personnelPositionOptions} /></FormLine>
          <FormLine name="employeeLevel" label="员工层级"><Select options={employeeLevelOptions} /></FormLine>
          <FormLine name="personnelCategory" label="人员类别"><Select options={personnelCategoryOptions} /></FormLine>
          <FormLine name="employmentRelationship" label="雇佣关系"><Select options={employmentRelationshipOptions} /></FormLine>
          <FormLine name="personnelSource" label="人员来源"><Select options={personnelSourceOptions} /></FormLine>
          <FormLine name="workArrangement" label="用工形式"><Select options={workArrangementOptions} /></FormLine>
          <FormLine name="employmentStatus" label="人员状态" note="人员状态需通过对应任职流程维护"><Select disabled options={employmentStatusOptions} /></FormLine>
        </FormSection>
        <FormSection title="紧急联系人">
          <FormLine name="emergencyContactName" label="紧急联系人"><Input /></FormLine>
          <FormLine name="emergencyContactRelationship" label="与本人关系"><Input /></FormLine>
          <FormLine name="emergencyContactMobile" label="紧急联系人电话"><Input /></FormLine>
        </FormSection>
        <FormSection title="银行资料">
          <FormLine name="bankName" label="银行"><Select options={bankNameOptions} /></FormLine>
          <FormLine name="bankBranchName" label="开户行支行"><Input /></FormLine>
          <FormLine name="bankAccountNumber" label="银行账号"><Input maxLength={19} /></FormLine>
        </FormSection>
        <FormSection title="教育经历">
          <FormLine name="graduationSchoolName" label="毕业学校名称"><Input /></FormLine>
          <FormLine name="institutionType" label="院校类型"><Select options={institutionTypeOptions} /></FormLine>
          <FormLine name="highestEducation" label="最高学历"><Select options={educationLevelOptions} /></FormLine>
          <FormLine name="graduationDate" label="毕业时间"><DatePicker /></FormLine>
          <FormLine name="major" label="专业"><Input /></FormLine>
        </FormSection>
      </Form>
    );
  }

  return (
    <Form<EmployeeFormValues> id={formId} form={form} requiredMark={false} onFinish={handleFinish} className="employee-form">
      <FormSection title="员工信息">
        <FormLine name="name" label="姓名" required rules={[{ required: true, message: '请输入姓名' }, { max: 50, message: '姓名不能超过 50 个字符' }]}><Input autoComplete="off" /></FormLine>
        <FormLine name="workEmail" label="企业邮箱" required rules={[{ required: true, message: '请输入企业邮箱' }, { type: 'email', message: '请输入有效的企业邮箱' }]}><Input autoComplete="off" /></FormLine>
        <FormLine name="personalEmail" label="个人邮箱" required rules={[{ required: true, message: '请输入个人邮箱' }, { type: 'email', message: '请输入有效的个人邮箱' }]}><Input autoComplete="off" /></FormLine>
        <FormLine name="mobile" label="手机号码" required rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入 11 位中国大陆手机号' }]}><Input inputMode="numeric" maxLength={11} autoComplete="off" /></FormLine>
        <FormLine name="gender" label="性别" required rules={[{ required: true, message: '请选择性别' }]}><Select placeholder="请选择" options={[{ value: 'MALE', label: '男' }, { value: 'FEMALE', label: '女' }, { value: 'UNDISCLOSED', label: '保密' }]} /></FormLine>
        <FormLine name="birthDate" label="出生日期" required rules={[{ required: true, message: '请选择出生日期' }]}><DatePicker /></FormLine>
        <FormLine name="ethnicity" label="民族" required rules={[{ required: true, message: '请选择民族' }]}><Select showSearch optionFilterProp="label" options={ethnicityOptions} /></FormLine>
        <FormLine name="maritalStatus" label="婚姻状况" required rules={[{ required: true, message: '请选择婚姻状况' }]}><Select options={maritalStatusOptions} /></FormLine>
        <FormLine name="politicalStatus" label="政治面貌" required rules={[{ required: true, message: '请选择政治面貌' }]}><Select options={politicalStatusOptions} /></FormLine>
        <FormLine name="nativePlace" label="籍贯"><Input maxLength={191} /></FormLine>
        <FormLine name="householdType" label="户口类别" required rules={[{ required: true, message: '请选择户口类别' }]}><Select options={householdTypeOptions} /></FormLine>
        <FormLine name="householdAddress" label="户籍所在地" required rules={[{ required: true, message: '请输入户籍所在地' }]}><Input maxLength={191} /></FormLine>
        <FormLine name="residentialAddress" label="联系地址" required rules={[{ required: true, message: '请输入联系地址' }]}><Input maxLength={191} /></FormLine>
        <FormLine name="documentType" label="证件类型" required rules={[{ required: true, message: '请选择证件类型' }]}><Select options={IDENTITY_DOCUMENT_TYPES.map((value) => ({ value, label: identityDocumentTypeLabels[value] }))} /></FormLine>
        <FormLine name="documentNumber" label="证件号码" required rules={[{ required: true, message: '请输入证件号码' }, { max: 64, message: '证件号码不能超过 64 个字符' }]}><Input maxLength={64} autoComplete="off" /></FormLine>
        <FormLine name="documentExpiryDate" label="证件截止日期" required rules={[{ required: true, message: '请选择证件截止日期' }]}><DatePicker /></FormLine>
        <FormLine name="inviteAccount" label="邀请激活账号" note="账号邀请流程尚未接入"><Radio.Group disabled options={[{ value: true, label: '是' }, { value: false, label: '否' }]} /></FormLine>
      </FormSection>

      <FormSection title="任职信息">
        <FormLine name="entryDate" label="入职日期" required rules={[{ required: true, message: '请选择入职日期' }]}><DatePicker placeholder="入职日期" /></FormLine>
        <FormLine name="employeeNo" label="工号" required rules={[{ required: true, message: '请输入工号' }, { max: 32, message: '工号不能超过 32 个字符' }, { pattern: /^[A-Za-z0-9_-]+$/, message: '只能使用字母、数字、下划线和连字符' }]}><Input autoComplete="off" /></FormLine>
        <FormLine name="organizationId" label="部门" required rules={[{ required: true, message: '请选择部门' }]}><Select placeholder="请选择" options={organizationOptions} showSearch optionFilterProp="label" onChange={() => form.setFieldValue('positionId', undefined)} /></FormLine>
        <FormLine name="positionId" label="职位"><Select placeholder="请搜索" showSearch optionFilterProp="label" options={positionOptions} /></FormLine>
        <FormLine name="jobLevel" label="职级"><Select placeholder="请搜索" showSearch optionFilterProp="label" filterOption={matchesJobLevelSearch} options={jobLevelOptions} /></FormLine>
        <FormLine name="personnelPosition" label="人员定位" required rules={[{ required: true, message: '请选择人员定位' }]}><Select options={personnelPositionOptions} /></FormLine>
        <FormLine name="employeeLevel" label="员工层级" required rules={[{ required: true, message: '请选择员工层级' }]}><Select options={employeeLevelOptions} /></FormLine>
        <FormLine name="workplaceId" label="工作地点"><Select placeholder="请选择" options={workplaceOptions} /></FormLine>
        <FormLine name="personnelCategory" label="人员类别" required rules={[{ required: true, message: '请选择人员类别' }]}><Select options={personnelCategoryOptions} /></FormLine>
        <FormLine name="employmentRelationship" label="雇佣关系" required rules={[{ required: true, message: '请选择雇佣关系' }]}><Select options={employmentRelationshipOptions} /></FormLine>
        <FormLine name="personnelSource" label="人员来源" required rules={[{ required: true, message: '请选择人员来源' }]}><Select options={personnelSourceOptions} /></FormLine>
        <FormLine name="workArrangement" label="用工形式" required rules={[{ required: true, message: '请选择用工形式' }]}><Select options={workArrangementOptions} /></FormLine>
        <FormLine name="hasProbation" label="是否有试用期" required rules={[{ required: true, message: '请选择是否有试用期' }]}><Select options={[{ value: true, label: '是' }, { value: false, label: '否' }]} onChange={(value) => { if (!value) form.setFieldsValue({ probationMonths: undefined, probationEndDate: undefined }); }} /></FormLine>
        <Form.Item<EmployeeFormValues> name="employmentStatus" hidden><Input /></Form.Item>
      </FormSection>

      <FormSection title="紧急联系人">
        <FormLine name="emergencyContactName" label="紧急联系人" required rules={[{ required: true, message: '请输入紧急联系人' }]}><Input /></FormLine>
        <FormLine name="emergencyContactRelationship" label="与本人关系" required rules={[{ required: true, message: '请输入与本人关系' }]}><Input /></FormLine>
        <FormLine name="emergencyContactMobile" label="紧急联系人电话" required rules={[{ required: true, message: '请输入紧急联系人电话' }]}><Input /></FormLine>
      </FormSection>

      <FormSection title="银行资料">
        <FormLine name="bankName" label="银行" required rules={[{ required: true, message: '请选择银行' }]}><Select options={bankNameOptions} /></FormLine>
        <FormLine name="bankBranchName" label="开户行支行" required rules={[{ required: true, message: '请输入开户行支行' }]}><Input maxLength={191} /></FormLine>
        <FormLine name="bankAccountNumber" label="银行账号" required rules={[{ required: true, message: '请输入银行账号' }, { pattern: /^\d{1,19}$/, message: '请输入 1 至 19 位数字' }]}><Input inputMode="numeric" maxLength={19} /></FormLine>
      </FormSection>

      <FormSection title="教育经历">
        <FormLine name="graduationSchoolName" label="毕业学校名称" required rules={[{ required: true, message: '请输入毕业学校名称' }]}><Input /></FormLine>
        <FormLine name="institutionType" label="院校类型" required rules={[{ required: true, message: '请选择院校类型' }]}><Select options={institutionTypeOptions} /></FormLine>
        <FormLine name="highestEducation" label="最高学历" required rules={[{ required: true, message: '请选择最高学历' }]}><Select options={educationLevelOptions} /></FormLine>
        <FormLine name="graduationDate" label="毕业时间" required rules={[{ required: true, message: '请选择毕业时间' }]}><DatePicker /></FormLine>
        <FormLine name="major" label="专业" required rules={[{ required: true, message: '请输入专业' }]}><Input /></FormLine>
      </FormSection>

      <FormSection title="试用期信息">
        <FormLine name="probationMonths" label="试用期（月）" required={hasProbation} rules={hasProbation ? [{ required: true, message: '请输入试用期月数' }] : []}><InputNumber disabled={!hasProbation} min={1} max={12} onChange={(value) => suggestEndDate('probationEndDate', value ?? undefined)} /></FormLine>
        <FormLine name="probationEndDate" label="预计试用结束日期" required={hasProbation} rules={hasProbation ? [{ required: true, message: '请选择预计试用结束日期' }] : []}><DatePicker disabled={!hasProbation} placeholder="预计试用结束日期" /></FormLine>
      </FormSection>

      <FormSection title="汇报关系">
        <FormLine name="managerEmployeeId" label="直接经理"><Select allowClear placeholder="请选择" showSearch optionFilterProp="label" options={managerOptions} /></FormLine>
      </FormSection>

      <FormSection title="合同协议">
        <FormLine name="agreementEmployingCompanyId" label="全日制公司" required rules={[{ required: true, message: '请选择全日制公司' }]}><Select showSearch optionFilterProp="label" options={employingCompanyOptions} /></FormLine>
        <FormLine name="contractTermType" label="期限类型" required rules={[{ required: true, message: '请选择期限类型' }]}><Select placeholder="请选择" options={[{ value: 'FIXED', label: '固定期限' }, { value: 'OPEN_ENDED', label: '无固定期限' }]} onChange={(value) => { if (value !== 'FIXED') form.setFieldsValue({ contractMonths: undefined, contractEndDate: undefined }); }} /></FormLine>
        <FormLine name="contractMonths" label="合同期限（月）" required={contractTermType === 'FIXED'} rules={contractTermType === 'FIXED' ? [{ required: true, message: '请输入合同期限' }] : []}><InputNumber disabled={contractTermType !== 'FIXED'} min={1} max={120} onChange={(value) => suggestEndDate('contractEndDate', value ?? undefined)} /></FormLine>
        <FormLine name="contractEndDate" label="终止日期" required={contractTermType === 'FIXED'} rules={contractTermType === 'FIXED' ? [{ required: true, message: '请选择终止日期' }] : []}><DatePicker disabled={contractTermType !== 'FIXED'} placeholder="终止日期" /></FormLine>
      </FormSection>
    </Form>
  );
}
