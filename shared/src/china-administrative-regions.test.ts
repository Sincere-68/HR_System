import {
  CHINA_ADMINISTRATIVE_REGIONS,
  displayChinaAdministrativeRegion,
  formatChinaAdministrativeRegion,
  getChinaAdministrativeRegionNameFromCode,
  getChinaAdministrativeRegionPath,
  isChinaAdministrativeRegionCode,
  normalizeChinaAdministrativeRegionName,
} from './china-administrative-regions';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function verifyChinaAdministrativeRegions() {
  assert(CHINA_ADMINISTRATIVE_REGIONS.length === 31, '地区目录必须包含 31 个省级行政区划');
  assert(isChinaAdministrativeRegionCode('31'), '上海市省级代码必须存在');
  assert(isChinaAdministrativeRegionCode('3101'), '上海市市级代码必须存在');
  assert(isChinaAdministrativeRegionCode('310115'), '浦东新区区县级代码必须存在');
  assert(!isChinaAdministrativeRegionCode('999999'), '未知地区代码不得被识别为有效');
  assert(
    JSON.stringify(getChinaAdministrativeRegionPath('310115'))
      === JSON.stringify({ codes: ['31', '3101', '310115'], names: ['上海市', '市辖区', '浦东新区'] }),
    '地区代码必须可解析为完整行政区划路径',
  );
  assert(
    formatChinaAdministrativeRegion('310115') === '上海市 / 市辖区 / 浦东新区',
    '地区代码必须可格式化为显示路径',
  );
  assert(
    getChinaAdministrativeRegionNameFromCode('420111') === '湖北省 / 武汉市 / 洪山区',
    '旧代码必须可转换为完整中文层级',
  );
  assert(
    normalizeChinaAdministrativeRegionName('湖北省 / 武汉市 / 洪山区') === '湖北省 / 武汉市 / 洪山区',
    '完整中文层级必须规范化为存储路径',
  );
  assert(
    normalizeChinaAdministrativeRegionName('湖北省武汉市洪山区') === '湖北省 / 武汉市 / 洪山区',
    '无分隔符的完整中文层级必须规范化为存储路径',
  );
  assert(
    normalizeChinaAdministrativeRegionName('洪山区') === null,
    '末级名称可能重名，不能作为可确认地区输入',
  );
  assert(
    displayChinaAdministrativeRegion(null, '310115') === '上海市 / 市辖区 / 浦东新区',
    '新字段为空时必须兼容展示旧代码',
  );
}

verifyChinaAdministrativeRegions();
