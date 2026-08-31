import { presentBlacklistListItem } from './blacklist.presenter';

const record = {
  id: 'blacklist-1',
  employeeId: 'employee-1',
  name: '虚构黑名单人员',
  documentNumber: '110101199901015001',
  mobile: '13800005001',
  reason: '虚构测试原因',
  effectiveDate: new Date('2026-08-01T00:00:00.000Z'),
  expiryDate: new Date('2027-08-01T00:00:00.000Z'),
  employee: { workEmail: 'fictional.employee@example.invalid' },
};

describe('presentBlacklistListItem', () => {
  it('returns blacklist fields in full', () => {
    expect(presentBlacklistListItem(record)).toEqual(expect.objectContaining({
      documentNumber: record.documentNumber,
      mobile: record.mobile,
      workEmail: record.employee.workEmail,
      effectiveDate: '2026-08-01',
      expiryDate: '2027-08-01',
    }));
  });

  it('returns the associated employee work email', () => {
    expect(presentBlacklistListItem(record)).toEqual(expect.objectContaining({
      documentNumber: record.documentNumber,
      mobile: record.mobile,
      workEmail: record.employee?.workEmail,
    }));
  });

  it('returns null for an independent blacklist record', () => {
    expect(presentBlacklistListItem({ ...record, employeeId: null, employee: null })).toEqual(
      expect.objectContaining({ workEmail: null }),
    );
  });
});
