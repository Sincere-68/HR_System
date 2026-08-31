import { AGREEMENT_TYPES } from '@hr-demo/shared';
import { describe, expect, it } from 'vitest';
import {
  AGREEMENT_TYPE_LABELS,
  AGREEMENT_TYPE_OPTIONS,
  renderAgreementType,
} from './agreement-types';

const expectedLabels = {
  LABOR_CONTRACT: '劳动合同',
  LABOR_SERVICE_CONTRACT: '劳务合同',
  INTERNSHIP_AGREEMENT: '实习协议',
  OTHER: '其他',
  NON_COMPETE_AGREEMENT: '竞业协议',
  RETIREE_REEMPLOYMENT_AGREEMENT: '退休返聘协议',
  NON_FULL_TIME_EMPLOYMENT_CONTRACT: '非全日制用工合同',
  SPECIAL_AGREEMENT: '专项协议',
  PART_TIME_SERVICE_AGREEMENT: '兼职服务协议',
} as const;

describe('agreement type configuration', () => {
  it('maps all nine agreement types to their labels', () => {
    expect(AGREEMENT_TYPES).toHaveLength(9);
    expect(AGREEMENT_TYPE_LABELS).toEqual(expectedLabels);
    expect(AGREEMENT_TYPE_OPTIONS).toEqual(
      AGREEMENT_TYPES.map((value) => ({ value, label: expectedLabels[value] })),
    );
  });

  it('renders every agreement type and nullable values', () => {
    for (const agreementType of AGREEMENT_TYPES) {
      expect(renderAgreementType(agreementType)).toBe(expectedLabels[agreementType]);
    }
    expect(renderAgreementType(null)).toBe('--');
    expect(renderAgreementType(undefined)).toBe('--');
  });
});
