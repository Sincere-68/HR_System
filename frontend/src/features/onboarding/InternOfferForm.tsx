import type { ReactNode } from 'react';
import {
  matchesPositionCatalogEntry,
  type AgreementType,
  type ContractTermType,
  type CreateInternOfferInput,
  type EducationLevel,
  type EmployeeLevel,
  type Gender,
  type IdentityDocumentType,
  type InternConversionOfferPrefill,
  type InternOfferFormOptions,
  type JobLevel,
  type PersonnelCategory,
  type PersonnelSource,
  type WorkArrangement,
} from '@hr-demo/shared';
import { Button, DatePicker, Form, Input, InputNumber, Select } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import { useMemo } from 'react';
import type { DefaultOptionType } from 'antd/es/select';
import { OrganizationTreeSelect } from '../../components/OrganizationTreeSelect';
import { AGREEMENT_TYPE_OPTIONS } from '../../config/agreement-types';
import {
  educationLevelOptions,
  employeeLevelOptions,
  identityDocumentTypeOptions,
  jobLevelOptions,
  personnelCategoryOptions,
  personnelSourceOptions,
  workArrangementOptions,
} from '../../config/personnel-fields';

const UNSUPPORTED_OFFER_FIELD_NOTE = '当前实习 Offer 创建接口不支持，当前不会保存';
const ORGANIZATION_FULL_NAME_NOTE = '当前目录接口未提供上级组织信息，无法计算组织全称';
const DECIMAL_STRING = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;
const EMPTY_VALUE = '--';

const genderOptions = [
  { value: 'MALE', label: '男' },
  { value: 'FEMALE', label: '女' },
  { value: 'UNDISCLOSED', label: '保密' },
];

const contractTermTypeOptions = [
  { value: 'FIXED', label: '固定期限' },
  { value: 'OPEN_ENDED', label: '无固定期限' },
];

const booleanOptions = [
  { value: true, label: '是' },
  { value: false, label: '否' },
];

type FormDateValue = Dayjs | string | null | undefined;
type DecimalFormValue = string | number | null | undefined;

export interface InternOfferFormValues {
  name?: string;
  mobile?: string;
  personalEmail?: string;
  source?: PersonnelSource;
  documentType?: IdentityDocumentType;
  documentNumber?: string;
  documentExpiryDate?: FormDateValue;
  gender?: Gender;
  birthDate?: FormDateValue;
  workStartDate?: FormDateValue;
  graduationSchoolName?: string;
  major?: string;
  highestEducation?: EducationLevel;
  graduationDate?: FormDateValue;
  organizationId?: string;
  proposedEntryDate?: FormDateValue;
  positionId?: string;
  jobLevel?: JobLevel;
  employeeLevel?: EmployeeLevel;
  personnelCategory?: PersonnelCategory;
  workArrangement?: WorkArrangement;
  workplaceName?: string;
  hasProbation?: boolean;
  probationMonths?: number | null;
  directManagerEmployeeId?: string;
  employingCompanyId?: string;
  agreementType?: AgreementType;
  contractTermType?: ContractTermType;
  contractMonths?: number | null;
  contractEndDate?: FormDateValue;
  isSeparatelySigned?: boolean;
  salaryPackage?: string;
  salaryRemark?: string;
  preConfirmationBaseSalary?: DecimalFormValue;
  postConfirmationBaseSalary?: DecimalFormValue;
  preConfirmationMonthlyPerformance?: DecimalFormValue;
  postConfirmationMonthlyPerformance?: DecimalFormValue;
  preConfirmationMonthlyManagementPerformance?: DecimalFormValue;
  postConfirmationMonthlyManagementPerformance?: DecimalFormValue;
  fullTimeContractSalary?: DecimalFormValue;
  annualPerformance?: DecimalFormValue;
  partTimePositionName?: string;
  partTimeHourlyRate?: DecimalFormValue;
}

interface InternOfferFormProps {
  formId: string;
  formOptions: InternOfferFormOptions;
  onSubmit: (input: CreateInternOfferInput) => void;
  /** Read-only server mapping for the selected current intern; all form values remain editable. */
  conversionPrefill?: InternConversionOfferPrefill | null;
}

interface FormLineProps {
  name?: keyof InternOfferFormValues;
  label: string;
  required?: boolean;
  note?: string;
  rules?: {
    required?: boolean;
    message?: string;
    max?: number;
    pattern?: RegExp;
    type?: 'email';
  }[];
  fullWidth?: boolean;
  children: ReactNode;
}

function FormLine({ name, label, required, note, rules, fullWidth, children }: FormLineProps) {
  const control = name ? (
    <Form.Item<InternOfferFormValues> className="employee-form-control" name={name} rules={rules} extra={note}>
      {children}
    </Form.Item>
  ) : (
    <div className="employee-form-control intern-offer-static-control">
      {children}
      {note ? <div className="ant-form-item-extra">{note}</div> : null}
    </div>
  );

  return (
    <div className={`employee-form-line${fullWidth ? ' intern-offer-full-line' : ''}`}>
      <span className="employee-form-label">{required ? <i>*</i> : null}{label}</span>
      {control}
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

function PendingInput({ ariaLabel, value }: { ariaLabel: string; value?: string }) {
  return <Input aria-label={ariaLabel} disabled value={value} placeholder={UNSUPPORTED_OFFER_FIELD_NOTE} />;
}

function ReadonlyInput({ ariaLabel, value }: { ariaLabel: string; value: string }) {
  return <Input aria-label={ariaLabel} disabled value={value} />;
}

function MobileInput({
  value,
  onChange,
}: {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="intern-offer-mobile-control">
      <Select aria-label="国家区号" disabled value="+86" options={[{ value: '+86', label: '+86' }]} />
      <Input aria-label="手机号码" value={value} onChange={onChange} inputMode="numeric" maxLength={11} autoComplete="off" />
    </div>
  );
}

function toDateString(value: FormDateValue) {
  if (!value) return undefined;
  return typeof value === 'string' ? value : value.format('YYYY-MM-DD');
}

function toOptionalString(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

/** Keeps stringMode decimal text intact; it never round-trips through a float. */
function toDecimalString(value: DecimalFormValue) {
  if (typeof value === 'string') return value.trim() || undefined;
  return typeof value === 'number' ? String(value) : undefined;
}

function hasSnapshotValues(snapshot: Record<string, string | undefined>) {
  return Object.values(snapshot).some((value) => value !== undefined);
}

function toDayjs(value: string | null | undefined) {
  return value ? dayjs(value) : undefined;
}

export function calculateAge(value: FormDateValue, today = dayjs()) {
  if (!value) return null;
  const birthDate = typeof value === 'string' ? dayjs(value) : value;
  if (!birthDate.isValid()) return null;
  let age = today.year() - birthDate.year();
  if (today.month() < birthDate.month() || (today.month() === birthDate.month() && today.date() < birthDate.date())) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

/** Maps the read-only current-intern response into fields accepted by direct Offer creation. */
export function internConversionPrefillToFormValues(prefill: InternConversionOfferPrefill): Partial<InternOfferFormValues> {
  return {
    name: prefill.name,
    mobile: prefill.mobile,
    personalEmail: prefill.personalEmail ?? undefined,
    source: prefill.source ?? undefined,
    documentType: prefill.identityDocument?.documentType,
    documentNumber: prefill.identityDocument?.documentNumber,
    documentExpiryDate: toDayjs(prefill.identityDocument?.expiryDate),
    gender: prefill.gender ?? undefined,
    birthDate: toDayjs(prefill.birthDate),
    graduationSchoolName: prefill.educationExperience?.schoolName,
    major: prefill.educationExperience?.major,
    highestEducation: prefill.educationExperience?.educationLevel,
    graduationDate: toDayjs(prefill.educationExperience?.graduationDate),
    organizationId: prefill.organizationId ?? undefined,
    positionId: prefill.positionId ?? undefined,
    workplaceName: prefill.workplaceName ?? undefined,
    jobLevel: prefill.jobLevel ?? undefined,
    employeeLevel: prefill.employeeLevel ?? undefined,
    personnelCategory: prefill.personnelCategory ?? undefined,
    workArrangement: prefill.workArrangement ?? undefined,
    directManagerEmployeeId: prefill.directManagerEmployeeId ?? undefined,
    employingCompanyId: prefill.employingCompanyId ?? undefined,
    agreementType: prefill.agreementType ?? undefined,
    contractTermType: prefill.contractTermType ?? undefined,
    contractEndDate: toDayjs(prefill.contractEndDate),
    hasProbation: false,
    isSeparatelySigned: false,
  };
}

export function toCreateInternOfferInput(values: InternOfferFormValues): CreateInternOfferInput {
  const identityDocument = toOptionalString(values.documentNumber)
    ? {
      documentType: values.documentType ?? 'NATIONAL_ID',
      documentNumber: toOptionalString(values.documentNumber)!,
      isPrimary: true,
      expiryDate: toDateString(values.documentExpiryDate),
    }
    : undefined;
  const educationExperience = toOptionalString(values.graduationSchoolName) && values.highestEducation
    ? {
      schoolName: toOptionalString(values.graduationSchoolName)!,
      educationLevel: values.highestEducation,
      major: toOptionalString(values.major),
      graduationDate: toDateString(values.graduationDate),
      isHighestEducation: true,
    }
    : undefined;
  const compensationSnapshot = {
    salaryPackage: toOptionalString(values.salaryPackage),
    salaryRemark: toOptionalString(values.salaryRemark),
    preConfirmationBaseSalary: toDecimalString(values.preConfirmationBaseSalary),
    postConfirmationBaseSalary: toDecimalString(values.postConfirmationBaseSalary),
    preConfirmationMonthlyPerformance: toDecimalString(values.preConfirmationMonthlyPerformance),
    postConfirmationMonthlyPerformance: toDecimalString(values.postConfirmationMonthlyPerformance),
    preConfirmationMonthlyManagementPerformance: toDecimalString(values.preConfirmationMonthlyManagementPerformance),
    postConfirmationMonthlyManagementPerformance: toDecimalString(values.postConfirmationMonthlyManagementPerformance),
    fullTimeContractSalary: toDecimalString(values.fullTimeContractSalary),
    annualPerformance: toDecimalString(values.annualPerformance),
  };
  const partTimeSnapshot = {
    positionName: toOptionalString(values.partTimePositionName),
    hourlyRate: toDecimalString(values.partTimeHourlyRate),
  };

  return {
    name: toOptionalString(values.name)!,
    mobile: toOptionalString(values.mobile)!,
    personalEmail: toOptionalString(values.personalEmail)!,
    source: values.source!,
    ...(values.gender ? { gender: values.gender } : {}),
    ...(toDateString(values.birthDate) ? { birthDate: toDateString(values.birthDate) } : {}),
    ...(toDateString(values.workStartDate) ? { workStartDate: toDateString(values.workStartDate) } : {}),
    ...(identityDocument ? { identityDocument } : {}),
    ...(educationExperience ? { educationExperience } : {}),
    organizationId: values.organizationId!,
    positionId: values.positionId!,
    ...(toOptionalString(values.workplaceName) ? { workplaceName: toOptionalString(values.workplaceName) } : {}),
    proposedEntryDate: toDateString(values.proposedEntryDate)!,
    ...(values.hasProbation && values.probationMonths ? { probationMonths: values.probationMonths } : {}),
    ...(values.jobLevel ? { jobLevel: values.jobLevel } : {}),
    ...(values.employeeLevel ? { employeeLevel: values.employeeLevel } : {}),
    ...(values.personnelCategory ? { personnelCategory: values.personnelCategory } : {}),
    ...(values.workArrangement ? { workArrangement: values.workArrangement } : {}),
    ...(toOptionalString(values.directManagerEmployeeId) ? { directManagerEmployeeId: toOptionalString(values.directManagerEmployeeId) } : {}),
    ...(toOptionalString(values.employingCompanyId) ? { employingCompanyId: toOptionalString(values.employingCompanyId) } : {}),
    ...(values.agreementType ? { agreementType: values.agreementType } : {}),
    ...(values.contractTermType ? { contractTermType: values.contractTermType } : {}),
    ...(values.contractTermType === 'FIXED' && values.contractMonths ? { contractMonths: values.contractMonths } : {}),
    ...(values.contractTermType === 'FIXED' && toDateString(values.contractEndDate)
      ? { contractEndDate: toDateString(values.contractEndDate) }
      : {}),
    ...(typeof values.isSeparatelySigned === 'boolean' ? { isSeparatelySigned: values.isSeparatelySigned } : {}),
    ...(hasSnapshotValues(compensationSnapshot) ? { compensationSnapshot } : {}),
    ...(hasSnapshotValues(partTimeSnapshot) ? { partTimeSnapshot } : {}),
  };
}

export function InternOfferForm({ formId, formOptions, onSubmit, conversionPrefill }: InternOfferFormProps) {
  const [form] = Form.useForm<InternOfferFormValues>();
  const hasProbation = Form.useWatch('hasProbation', form);
  const contractTermType = Form.useWatch('contractTermType', form);
  const proposedEntryDate = Form.useWatch('proposedEntryDate', form);
  const birthDate = Form.useWatch('birthDate', form);

  const positionOptions = useMemo(
    () => formOptions.positions.map(({ id, code, name }) => ({ value: id, label: code ? `${code} - ${name}` : name, code, name })),
    [formOptions.positions],
  );
  const managerOptions = useMemo(
    () => (formOptions.managers ?? []).map(({ id, name, employeeNo }) => ({ value: id, label: `${name}（${employeeNo}）` })),
    [formOptions.managers],
  );
  const employingCompanyOptions = useMemo(
    () => formOptions.employingCompanies.map(({ id, name }) => ({ value: id, label: name })),
    [formOptions.employingCompanies],
  );
  const initialValues = useMemo<InternOfferFormValues>(() => ({
    documentType: 'NATIONAL_ID',
    hasProbation: false,
    isSeparatelySigned: false,
    ...(conversionPrefill ? internConversionPrefillToFormValues(conversionPrefill) : {}),
  }), [conversionPrefill]);
  const officeAddress = EMPTY_VALUE;
  const age = calculateAge(birthDate);
  const sourceOptions: DefaultOptionType[] = personnelSourceOptions.map((option) => ({ ...option }));

  const suggestContractEndDate = (months: number | string | null) => {
    if (!proposedEntryDate || !months) return;
    const startDate = typeof proposedEntryDate === 'string' ? dayjs(proposedEntryDate) : proposedEntryDate;
    const duration = Number(months);
    if (startDate.isValid() && Number.isInteger(duration) && duration > 0) {
      form.setFieldValue('contractEndDate', startDate.add(duration, 'month'));
    }
  };

  return (
    <Form<InternOfferFormValues>
      id={formId}
      form={form}
      initialValues={initialValues}
      requiredMark={false}
      onFinish={(values) => onSubmit(toCreateInternOfferInput(values))}
      className="employee-form intern-offer-form"
    >
      <FormSection title="候选人信息">
        <FormLine label="校招Offer" required note={UNSUPPORTED_OFFER_FIELD_NOTE}><PendingInput ariaLabel="校招Offer" /></FormLine>
        <FormLine name="name" label="姓名" required rules={[{ required: true, message: '请输入姓名' }, { max: 50, message: '姓名不能超过 50 个字符' }]}><Input aria-label="姓名" autoComplete="off" maxLength={50} /></FormLine>
        <FormLine name="mobile" label="手机号码" required rules={[{ required: true, message: '请输入手机号' }, { pattern: /^1\d{10}$/, message: '请输入 11 位中国大陆手机号' }]}><MobileInput /></FormLine>
        <FormLine name="personalEmail" label="个人邮箱" required rules={[{ required: true, message: '请输入个人邮箱' }, { type: 'email', message: '请输入有效的个人邮箱' }]}><Input aria-label="个人邮箱" autoComplete="off" maxLength={191} /></FormLine>
        <FormLine name="documentType" label="证件类型"><Select aria-label="证件类型" showSearch optionFilterProp="label" options={identityDocumentTypeOptions} /></FormLine>
        <FormLine name="documentNumber" label="证件号码" rules={[{ max: 64, message: '证件号码不能超过 64 个字符' }]}><Input aria-label="证件号码" autoComplete="off" maxLength={64} /></FormLine>
        <FormLine name="documentExpiryDate" label="证件截止日期"><DatePicker aria-label="证件截止日期" placeholder="请选择" /></FormLine>
        <FormLine name="gender" label="性别"><Select aria-label="性别" placeholder="请选择" options={genderOptions} /></FormLine>
        <FormLine name="birthDate" label="出生日期"><DatePicker aria-label="出生日期" placeholder="请选择" /></FormLine>
        <FormLine label="年龄"><ReadonlyInput ariaLabel="年龄" value={age === null ? EMPTY_VALUE : String(age)} /></FormLine>
        <FormLine name="workStartDate" label="参加工作日期"><DatePicker aria-label="参加工作日期" placeholder="请选择" /></FormLine>
        <FormLine label="雇佣关系" required note={UNSUPPORTED_OFFER_FIELD_NOTE}><PendingInput ariaLabel="雇佣关系" value="实习生（INTERN）" /></FormLine>
        <FormLine name="graduationSchoolName" label="毕业学校名称"><Input aria-label="毕业学校名称" autoComplete="off" maxLength={191} /></FormLine>
        <FormLine name="major" label="专业"><Input aria-label="专业" autoComplete="off" maxLength={191} /></FormLine>
        <FormLine name="highestEducation" label="最高学历"><Select aria-label="最高学历" placeholder="请选择" options={educationLevelOptions} /></FormLine>
        <FormLine name="graduationDate" label="毕业时间"><DatePicker aria-label="毕业时间" placeholder="请选择" /></FormLine>
      </FormSection>

      <FormSection title="任职信息">
        <FormLine name="organizationId" label="录用部门" required rules={[{ required: true, message: '请选择录用部门' }]}><OrganizationTreeSelect aria-label="录用部门" organizations={formOptions.organizations} placeholder="请选择" /></FormLine>
        <FormLine name="proposedEntryDate" label="计划入职日期" required rules={[{ required: true, message: '请选择计划入职日期' }]}><DatePicker aria-label="计划入职日期" placeholder="请选择" /></FormLine>
        <FormLine label="组织全称" note={ORGANIZATION_FULL_NAME_NOTE}><ReadonlyInput ariaLabel="组织全称" value={EMPTY_VALUE} /></FormLine>
        <FormLine name="positionId" label="职位" required rules={[{ required: true, message: '请选择职位' }]}><Select aria-label="职位" placeholder="按职位编号或名称搜索" showSearch filterOption={(input, option) => matchesPositionCatalogEntry({ code: String(option?.code ?? ''), name: String(option?.name ?? '') }, input)} options={positionOptions} /></FormLine>
        <FormLine name="source" label="人员来源" required rules={[{ required: true, message: '请选择人员来源' }]}><Select aria-label="人员来源" placeholder="请选择" virtual={false} options={sourceOptions} /></FormLine>
        <FormLine name="jobLevel" label="职级"><Select aria-label="职级" placeholder="请选择" showSearch optionFilterProp="label" options={jobLevelOptions} /></FormLine>
        <FormLine name="employeeLevel" label="员工层级"><Select aria-label="员工层级" placeholder="请选择" options={employeeLevelOptions} /></FormLine>
        <FormLine name="personnelCategory" label="人员类别"><Select aria-label="人员类别" placeholder="请选择" options={personnelCategoryOptions} /></FormLine>
        <FormLine name="workArrangement" label="用工形式"><Select aria-label="用工形式" placeholder="请选择" options={workArrangementOptions} /></FormLine>
        <FormLine name="workplaceName" label="工作地点"><Input aria-label="工作地点" placeholder="请输入（可选）" maxLength={191} /></FormLine>
        <FormLine label="办公地址"><ReadonlyInput ariaLabel="办公地址" value={officeAddress} /></FormLine>
        <FormLine name="hasProbation" label="是否有试用期"><Select aria-label="是否有试用期" options={booleanOptions} onChange={(value) => { if (!value) form.setFieldValue('probationMonths', undefined); }} /></FormLine>
        <FormLine name="probationMonths" label="试用期（月）" required={hasProbation} rules={hasProbation ? [{ required: true, message: '请输入试用期月数' }] : []}><InputNumber aria-label="试用期（月）" disabled={!hasProbation} placeholder="请输入" min={1} max={12} precision={0} /></FormLine>
        <FormLine name="directManagerEmployeeId" label="直线上级"><Select aria-label="直线上级" allowClear placeholder="请选择" showSearch optionFilterProp="label" options={managerOptions} /></FormLine>
        <FormLine label="虚线上级" note={UNSUPPORTED_OFFER_FIELD_NOTE}><PendingInput ariaLabel="虚线上级" /></FormLine>
        <FormLine label="是否部门负责人" note={UNSUPPORTED_OFFER_FIELD_NOTE}><Select aria-label="是否部门负责人" disabled placeholder={UNSUPPORTED_OFFER_FIELD_NOTE} options={booleanOptions} /></FormLine>
      </FormSection>

      <FormSection title="薪资信息">
        <FormLine name="salaryPackage" label="薪资包"><Input aria-label="薪资包" autoComplete="off" maxLength={191} /></FormLine>
        <FormLine name="salaryRemark" label="薪资备注"><Input aria-label="薪资备注" autoComplete="off" maxLength={10000} /></FormLine>
        <FormLine name="preConfirmationBaseSalary" label="转正前基本工资" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负金额' }]}><InputNumber<string> aria-label="转正前基本工资" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
        <FormLine name="postConfirmationBaseSalary" label="转正后基本工资" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负金额' }]}><InputNumber<string> aria-label="转正后基本工资" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
        <FormLine name="preConfirmationMonthlyPerformance" label="转正前月度绩效" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负金额' }]}><InputNumber<string> aria-label="转正前月度绩效" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
        <FormLine name="postConfirmationMonthlyPerformance" label="转正后月度绩效" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负金额' }]}><InputNumber<string> aria-label="转正后月度绩效" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
        <FormLine name="preConfirmationMonthlyManagementPerformance" label="转正前月度管理绩效" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负金额' }]}><InputNumber<string> aria-label="转正前月度管理绩效" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
        <FormLine name="postConfirmationMonthlyManagementPerformance" label="转正后月度管理绩效" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负金额' }]}><InputNumber<string> aria-label="转正后月度管理绩效" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
        <FormLine name="fullTimeContractSalary" label="全日制合同薪资" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负金额' }]}><InputNumber<string> aria-label="全日制合同薪资" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
        <FormLine name="annualPerformance" label="年度绩效" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负金额' }]}><InputNumber<string> aria-label="年度绩效" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
        <FormLine name="partTimePositionName" label="非全日制岗位"><Input aria-label="非全日制岗位" autoComplete="off" maxLength={191} /></FormLine>
        <FormLine name="partTimeHourlyRate" label="小时费率" rules={[{ pattern: DECIMAL_STRING, message: '请输入最多两位小数的非负时薪' }]}><InputNumber<string> aria-label="小时费率" stringMode min="0" precision={2} placeholder="请输入" /></FormLine>
      </FormSection>

      <FormSection title="合同">
        <div className="intern-offer-contract-snapshot" role="note">Offer 快照：合同信息仅作为本 Offer 的快照保存，不会直接创建员工合同。</div>
        <FormLine name="employingCompanyId" label="合同主体法人公司"><Select aria-label="合同主体法人公司" placeholder="请选择" showSearch optionFilterProp="label" options={employingCompanyOptions} /></FormLine>
        <FormLine name="agreementType" label="合同类型"><Select aria-label="合同类型" placeholder="请选择" options={AGREEMENT_TYPE_OPTIONS} /></FormLine>
        <FormLine name="contractTermType" label="期限类型"><Select aria-label="期限类型" placeholder="请选择" options={contractTermTypeOptions} onChange={(value) => { if (value !== 'FIXED') form.setFieldsValue({ contractMonths: undefined, contractEndDate: undefined }); }} /></FormLine>
        <FormLine name="contractMonths" label="合同期限（月）" required={contractTermType === 'FIXED'} rules={contractTermType === 'FIXED' ? [{ required: true, message: '请输入合同期限' }] : []}><InputNumber aria-label="合同期限（月）" disabled={contractTermType !== 'FIXED'} placeholder="请输入" min={1} max={120} precision={0} onChange={suggestContractEndDate} /></FormLine>
        <FormLine name="contractEndDate" label="终止日期" required={contractTermType === 'FIXED'} rules={contractTermType === 'FIXED' ? [{ required: true, message: '请选择终止日期' }] : []}><DatePicker aria-label="终止日期" disabled={contractTermType !== 'FIXED'} placeholder="请选择" /></FormLine>
        <FormLine name="isSeparatelySigned" label="是否单独签订"><Select aria-label="是否单独签订" options={booleanOptions} /></FormLine>
      </FormSection>

      <FormSection title="岗位职责说明书">
        <FormLine label="全日制岗位职责说明书" note={UNSUPPORTED_OFFER_FIELD_NOTE} fullWidth>
          <Input.TextArea aria-label="全日制岗位职责说明书" disabled maxLength={32766} placeholder={UNSUPPORTED_OFFER_FIELD_NOTE} autoSize={{ minRows: 5, maxRows: 10 }} />
        </FormLine>
      </FormSection>
    </Form>
  );
}
