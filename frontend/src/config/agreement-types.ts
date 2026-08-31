import {
  AGREEMENT_TYPES,
  type AgreementType,
} from '@hr-demo/shared';

export const AGREEMENT_TYPE_LABELS: Record<AgreementType, string> = {
  LABOR_CONTRACT: '劳动合同',
  LABOR_SERVICE_CONTRACT: '劳务合同',
  INTERNSHIP_AGREEMENT: '实习协议',
  OTHER: '其他',
  NON_COMPETE_AGREEMENT: '竞业协议',
  RETIREE_REEMPLOYMENT_AGREEMENT: '退休返聘协议',
  NON_FULL_TIME_EMPLOYMENT_CONTRACT: '非全日制用工合同',
  SPECIAL_AGREEMENT: '专项协议',
  PART_TIME_SERVICE_AGREEMENT: '兼职服务协议',
};

export const AGREEMENT_TYPE_OPTIONS = AGREEMENT_TYPES.map((value) => ({
  value,
  label: AGREEMENT_TYPE_LABELS[value],
}));

export function renderAgreementType(value: AgreementType | null | undefined) {
  return value ? AGREEMENT_TYPE_LABELS[value] : '--';
}
