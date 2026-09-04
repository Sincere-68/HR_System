import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateInternOfferDto } from './create-intern-offer.dto';

const validInput = {
  name: '虚构实习候选人',
  mobile: '13900001001',
  personalEmail: 'fictional.intern@example.invalid',
  source: 'SOCIAL_RECRUITMENT',
  organizationId: 'org-1',
  positionId: 'position-1',
  workplaceName: 'workplace-1',
  proposedEntryDate: '2026-09-01',
};

describe('CreateInternOfferDto', () => {
  it.each(['SOCIAL_RECRUITMENT', 'INTERNAL_REFERRAL', 'HEADHUNTER_REFERRAL', 'OTHER'])(
    'accepts confirmed PersonnelSource %s',
    async (source) => {
      const dto = plainToInstance(CreateInternOfferDto, { ...validInput, source });
      await expect(validate(dto)).resolves.toHaveLength(0);
    },
  );

  it('accepts named Candidate, Offer, salary and part-time snapshot fields', async () => {
    const dto = plainToInstance(CreateInternOfferDto, {
      ...validInput,
      gender: 'FEMALE',
      birthDate: '2002-01-01',
      workStartDate: '2025-06-01',
      identityDocument: { documentType: 'PASSPORT', documentNumber: 'TEST-PASSPORT-001', isPrimary: true, expiryDate: '2036-01-01' },
      educationExperience: { schoolName: '虚构大学', educationLevel: 'BACHELOR', major: '虚构专业', graduationDate: '2026-06-30', isHighestEducation: true },
      jobLevel: 'S1', employeeLevel: 'STAFF', personnelCategory: 'TALENT_PROGRAM', workArrangement: 'INTERN',
      directManagerEmployeeId: 'manager-1', employingCompanyId: 'company-1', agreementType: 'NON_FULL_TIME_EMPLOYMENT_CONTRACT',
      contractTermType: 'FIXED', contractMonths: 12, contractEndDate: '2027-09-01', isSeparatelySigned: false,
      compensationSnapshot: { preConfirmationBaseSalary: '0', postConfirmationBaseSalary: '8000.00', annualPerformance: '12000.5' },
      partTimeSnapshot: { positionName: '虚构非全职位', hourlyRate: '88.50' },
    });
    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects old email property and invalid formats/enums/decimal fields', async () => {
    const dto = plainToInstance(CreateInternOfferDto, {
      ...validInput,
      personalEmail: undefined,
      email: 'legacy@example.invalid',
      mobile: '+8613900001001',
      source: 'CAMPUS_RECRUITMENT',
      proposedEntryDate: '2026/09/01',
      identityDocument: { documentType: 'UNKNOWN', documentNumber: '' },
      compensationSnapshot: { postConfirmationBaseSalary: '-1.00', annualPerformance: '1.234' },
      partTimeSnapshot: { hourlyRate: '-0.01' },
    });

    const errors = await validate(dto);
    expect(errors.map(({ property }) => property)).toEqual(expect.arrayContaining([
      'personalEmail', 'mobile', 'source', 'proposedEntryDate', 'identityDocument', 'compensationSnapshot', 'partTimeSnapshot',
    ]));
  });

  it('allows an omitted workplace and does not expose source-path, work-schedule or approval fields', async () => {
    const dto = plainToInstance(CreateInternOfferDto, { ...validInput, workplaceName: undefined });
    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).not.toHaveProperty('employmentRelationship');
    expect(dto).not.toHaveProperty('creationPath');
    expect(dto).not.toHaveProperty('work' + 'Schedule');
    expect(dto).not.toHaveProperty('approvalRequestId');
    expect(dto).not.toHaveProperty('jobDescription');
  });
});
