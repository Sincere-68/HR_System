import { ORGANIZATION_CATALOG } from './organization-catalog';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyOrganizationCatalog() {
  assert(ORGANIZATION_CATALOG.length === 44, '组织目录必须包含 44 个节点');
  assert(
    new Set(ORGANIZATION_CATALOG.map(({ code }) => code)).size === ORGANIZATION_CATALOG.length,
    '组织编码不能重复',
  );
  const byCode = new Map(ORGANIZATION_CATALOG.map((entry) => [entry.code, entry]));
  const roots = ORGANIZATION_CATALOG.filter(({ parentCode }) => parentCode === null);
  assert(roots.length === 1, '组织目录必须只有一个根节点');
  assert(roots[0]?.name === '上海宜信电子商务有限公司', '根节点必须为上海宜信电子商务有限公司');
  assert(
    ORGANIZATION_CATALOG.every(({ parentCode }) => parentCode === null || byCode.has(parentCode)),
    '每个上级组织编码必须存在',
  );

  function depth(code: string, seen = new Set<string>()): number {
    if (seen.has(code)) throw new Error('组织树不能形成循环');
    const entry = byCode.get(code as typeof ORGANIZATION_CATALOG[number]['code']);
    if (!entry || entry.parentCode === null) return 1;
    seen.add(code);
    return depth(entry.parentCode, seen) + 1;
  }

  assert(Math.max(...ORGANIZATION_CATALOG.map(({ code }) => depth(code))) === 4, '组织树必须形成四个层次');
  assert(
    !ORGANIZATION_CATALOG.some(({ name }) => ['组织架构', '总部', '产品研发部', '运营部', '销售部'].includes(name)),
    '旧组织节点不得出现在新目录中',
  );
}

verifyOrganizationCatalog();
