import {
  IDENTITY_DOCUMENT_TYPES,
  IDENTITY_DOCUMENT_TYPE_LABELS,
} from './index';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyIdentityDocumentTypes() {
  assert(IDENTITY_DOCUMENT_TYPES.length === 60, '证件类型必须包含用户确认的 60 项');
  assert(
    new Set(IDENTITY_DOCUMENT_TYPES).size === IDENTITY_DOCUMENT_TYPES.length,
    '证件类型编码不能重复',
  );
  assert(
    Object.keys(IDENTITY_DOCUMENT_TYPE_LABELS).length === IDENTITY_DOCUMENT_TYPES.length,
    '每个证件类型必须有中文标签',
  );
  assert(
    IDENTITY_DOCUMENT_TYPES.every((type) => Boolean(IDENTITY_DOCUMENT_TYPE_LABELS[type]?.trim())),
    '证件类型中文标签不能为空',
  );
  assert(IDENTITY_DOCUMENT_TYPE_LABELS.SINGAPORE_EP === '新加坡亚籍（EP）', '新加坡 EP 标签错误');
  assert(IDENTITY_DOCUMENT_TYPE_LABELS.MALAYSIA_TECHNICAL_TRAINING_PASS === '马来西亚技工培训准证', '马来西亚培训准证标签错误');
  assert(IDENTITY_DOCUMENT_TYPE_LABELS.HK_DOCUMENT_OF_IDENTITY === '香港特别行政区签证身份书（黄本）', '香港签证身份书标签错误');
}

verifyIdentityDocumentTypes();
