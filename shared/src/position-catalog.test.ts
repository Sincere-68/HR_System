import {
  POSITION_CATALOG,
  matchesPositionCatalogEntry,
  searchPositionCatalog,
} from './position-catalog';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyPositionCatalog() {
  assert(POSITION_CATALOG.length === 288, '职位目录必须包含 288 个唯一职位名称');
  assert(
    new Set(POSITION_CATALOG.map(({ name }) => name)).size === POSITION_CATALOG.length,
    '职位名称不能重复',
  );
  assert(
    POSITION_CATALOG.every(({ name }) => name.trim().length > 0),
    '职位名称不能为空',
  );
  assert(
    searchPositionCatalog('前端工程师').some(({ name }) => name === 'web前端工程师'),
    '必须可按职位名称搜索',
  );
  assert(
    POSITION_CATALOG.filter(({ name }) => name === '运营经理').length === 1,
    '同名职位必须合并为一条记录',
  );
  assert(
    matchesPositionCatalogEntry({ name: 'web前端工程师' }, '前端'),
    '职位名称子串应匹配',
  );
}

verifyPositionCatalog();
