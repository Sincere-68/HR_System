import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import dayjs from 'dayjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InternConversionOfferPrefill, InternOfferFormOptions } from '@hr-demo/shared';
import {
  calculateAge,
  internConversionPrefillToFormValues,
  InternOfferForm,
  toCreateInternOfferInput,
  type InternOfferFormValues,
} from './InternOfferForm';

const formOptions: InternOfferFormOptions = {
  organizations: [{ id: 'org-1', name: '虚构研发部' }],
  positions: [
    { id: 'position-1', code: '00001', name: '财务总监', organizationId: null },
    { id: 'position-2', code: '00105', name: 'web前端工程师', organizationId: null },
  ],
  workplaces: [
    { id: 'workplace-1', name: '虚构园区', address: '虚构园区 1 号楼' },
    { id: 'workplace-2', name: '无地址园区', address: null },
  ],
  employingCompanies: [{ id: 'company-1', name: '虚构全日制公司' }],
  managers: [{ id: 'manager-1', name: '虚构经理', employeeNo: 'FAKE-M001' }],
};

const conversionPrefill: InternConversionOfferPrefill = {
  name: '虚构实习生',
  mobile: '13900001001',
  personalEmail: 'intern@example.invalid',
  source: 'INTERNAL_REFERRAL',
  gender: 'FEMALE',
  birthDate: '2002-01-01',
  identityDocument: { documentType: 'PASSPORT', documentNumber: 'TEST-PASSPORT-1', isPrimary: true, expiryDate: '2036-01-01' },
  educationExperience: { schoolName: '虚构大学', educationLevel: 'BACHELOR', major: '虚构专业', graduationDate: '2026-06-30', isHighestEducation: true },
  organizationId: 'org-1',
  positionId: 'position-1',
  workplaceId: 'workplace-1',
  jobLevel: 'S1',
  employeeLevel: 'STAFF',
  personnelCategory: 'TALENT_PROGRAM',
  workArrangement: 'INTERN',
  directManagerEmployeeId: 'manager-1',
  employingCompanyId: 'company-1',
  agreementType: 'INTERNSHIP_AGREEMENT',
  contractTermType: 'FIXED',
  contractEndDate: '2026-12-31',
};

function renderForm(onSubmit = vi.fn(), prefill?: InternConversionOfferPrefill | null) {
  render(<InternOfferForm formId="intern-offer-test-form" formOptions={formOptions} conversionPrefill={prefill} onSubmit={onSubmit} />);
  return onSubmit;
}

function field(label: string) {
  return screen.getAllByLabelText(label).at(-1)!;
}

afterEach(() => cleanup());

describe('InternOfferForm', () => {
  it('renders direct Offer fields with no work schedule or template controls', () => {
    renderForm();

    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      '候选人信息', '任职信息', '薪资信息', '合同', '岗位职责说明书',
    ]);
    const labels = [...document.querySelectorAll('.employee-form-label')].map((label) => label.textContent?.replace('*', ''));
    expect(labels).not.toContain('工时制度');
    expect(labels).not.toContain('Offer模板');
    for (const label of ['校招Offer', '雇佣关系', '虚线上级', '是否部门负责人', '全日制岗位职责说明书']) {
      expect(field(label)).toBeDisabled();
    }
    expect(field('工作地点')).toBeEnabled();
    expect(field('工作地点')).not.toBeRequired();
    expect(screen.queryByText(/活动 Offer 模板|应用模板/)).not.toBeInTheDocument();
  });

  it('uses code-name position labels and derives optional workplace address', () => {
    renderForm();
    expect(field('办公地址')).toHaveValue('--');
    fireEvent.mouseDown(field('职位'));
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('aria-label'))).toEqual([
      '00001 - 财务总监', '00105 - web前端工程师',
    ]);
    expect(calculateAge(dayjs('2000-09-02'), dayjs('2026-09-01'))).toBe(25);
    expect(calculateAge(undefined, dayjs('2026-09-01'))).toBeNull();
  });

  it('maps direct creation values without a workplace or creation-path/template fields', () => {
    const input = toCreateInternOfferInput({
      name: ' 虚构实习候选人 ', mobile: ' 13900001001 ', personalEmail: ' fictional.intern@example.invalid ', source: 'SOCIAL_RECRUITMENT',
      gender: 'FEMALE', birthDate: dayjs('2002-01-01'), workStartDate: dayjs('2025-06-01'),
      documentType: 'PASSPORT', documentNumber: ' test-passport-1 ', documentExpiryDate: dayjs('2036-01-01'),
      graduationSchoolName: ' 虚构大学 ', highestEducation: 'BACHELOR', major: ' 虚构专业 ', graduationDate: dayjs('2026-06-30'),
      organizationId: 'org-1', positionId: 'position-1', proposedEntryDate: dayjs('2026-09-01'),
      hasProbation: true, probationMonths: 3, jobLevel: 'S1', employeeLevel: 'STAFF', personnelCategory: 'TALENT_PROGRAM', workArrangement: 'INTERN', directManagerEmployeeId: 'manager-1',
      employingCompanyId: 'company-1', agreementType: 'INTERNSHIP_AGREEMENT', contractTermType: 'FIXED', contractMonths: 12, contractEndDate: dayjs('2027-09-01'), isSeparatelySigned: false,
      salaryPackage: ' 月薪包 ', salaryRemark: '说明', preConfirmationBaseSalary: '8000.50', postConfirmationBaseSalary: '9000.00',
      partTimePositionName: ' 兼职岗位 ', partTimeHourlyRate: '88.50',
    } as InternOfferFormValues);

    expect(input).toMatchObject({
      name: '虚构实习候选人', mobile: '13900001001', personalEmail: 'fictional.intern@example.invalid', source: 'SOCIAL_RECRUITMENT',
      organizationId: 'org-1', positionId: 'position-1', proposedEntryDate: '2026-09-01',
      identityDocument: { documentType: 'PASSPORT', documentNumber: 'test-passport-1', isPrimary: true, expiryDate: '2036-01-01' },
      educationExperience: { schoolName: '虚构大学', educationLevel: 'BACHELOR', major: '虚构专业', graduationDate: '2026-06-30', isHighestEducation: true },
    });
    expect(input).not.toHaveProperty('workplaceId');
    expect(input).not.toHaveProperty('creationPath');
    expect(input).not.toHaveProperty('templateId');
    expect(input).not.toHaveProperty('work' + 'Schedule');
  });

  it('maps a current intern prefill into editable direct Offer fields', () => {
    const values = internConversionPrefillToFormValues(conversionPrefill);
    expect(values).toMatchObject({
      name: '虚构实习生', mobile: '13900001001', personalEmail: 'intern@example.invalid', source: 'INTERNAL_REFERRAL',
      documentType: 'PASSPORT', documentNumber: 'TEST-PASSPORT-1', organizationId: 'org-1', positionId: 'position-1', workplaceId: 'workplace-1', directManagerEmployeeId: 'manager-1',
    });
    expect(values).not.toHaveProperty('creationPath');
    expect(values).not.toHaveProperty('work' + 'Schedule');
  });

  it('applies conversion prefill as the form initial state without a template request', () => {
    renderForm(vi.fn(), conversionPrefill);
    expect(field('姓名')).toHaveValue('虚构实习生');
    expect(field('手机号码')).toHaveValue('13900001001');
    expect(field('个人邮箱')).toHaveValue('intern@example.invalid');
  });
});
