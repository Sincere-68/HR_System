import {
  POSITION_CATALOG,
  matchesPositionCatalogEntry,
  searchPositionCatalog,
} from './position-catalog';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyPositionCatalog() {
  assert(POSITION_CATALOG.length === 434, '职位目录必须包含 434 条记录');
  assert(
    new Set(POSITION_CATALOG.map(({ code }) => code)).size === POSITION_CATALOG.length,
    '职位编号不能重复',
  );
  assert(
    POSITION_CATALOG.every(({ code, name }) => /^\d{5}$/.test(code) && name.trim().length > 0),
    '职位编号必须为五位数字且职位名称不能为空',
  );

  const frontendEngineer = searchPositionCatalog('00105');
  assert(
    frontendEngineer.length === 1
      && frontendEngineer[0]?.code === '00105'
      && frontendEngineer[0]?.name === 'web前端工程师',
    '必须可按职位编号搜索',
  );
  assert(
    searchPositionCatalog('前端工程师').some(({ code }) => code === '00105'),
    '必须可按职位名称搜索',
  );
  assert(
    searchPositionCatalog('渠道高级经理').length === 6,
    '相同职位名称但不同编号不得合并',
  );
  assert(
    matchesPositionCatalogEntry({ code: '00105', name: 'web前端工程师' }, '001'),
    '职位编号子串应匹配',
  );
}

verifyPositionCatalog();
