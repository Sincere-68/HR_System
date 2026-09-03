import {
  CHINA_ADMINISTRATIVE_REGIONS,
  formatChinaAdministrativeRegion,
  getChinaAdministrativeRegionPath,
  isChinaAdministrativeRegionCode,
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
}

verifyChinaAdministrativeRegions();
