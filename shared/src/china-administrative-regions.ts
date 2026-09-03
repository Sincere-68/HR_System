import chinaAdministrativeRegionsData from './china-administrative-regions.data.json';

export interface ChinaAdministrativeRegion {
  code: string;
  name: string;
  children?: ChinaAdministrativeRegion[];
}

export interface ChinaAdministrativeRegionPath {
  codes: string[];
  names: string[];
}

export interface ChinaAdministrativeRegionCascaderOption {
  value: string;
  label: string;
  children?: ChinaAdministrativeRegionCascaderOption[];
}

export const CHINA_ADMINISTRATIVE_REGIONS = chinaAdministrativeRegionsData as ChinaAdministrativeRegion[];

const regionPathsByCode = new Map<string, ChinaAdministrativeRegionPath>();

function indexRegionPaths(
  regions: readonly ChinaAdministrativeRegion[],
  parentPath: ChinaAdministrativeRegionPath = { codes: [], names: [] },
) {
  for (const region of regions) {
    const path = {
      codes: [...parentPath.codes, region.code],
      names: [...parentPath.names, region.name],
    };
    regionPathsByCode.set(region.code, path);
    if (region.children) indexRegionPaths(region.children, path);
  }
}

indexRegionPaths(CHINA_ADMINISTRATIVE_REGIONS);

export const CHINA_ADMINISTRATIVE_REGION_OPTIONS: ChinaAdministrativeRegionCascaderOption[] =
  CHINA_ADMINISTRATIVE_REGIONS.map(toCascaderOption);

function toCascaderOption(region: ChinaAdministrativeRegion): ChinaAdministrativeRegionCascaderOption {
  return {
    value: region.code,
    label: region.name,
    ...(region.children?.length ? { children: region.children.map(toCascaderOption) } : {}),
  };
}

export function isChinaAdministrativeRegionCode(value: string): boolean {
  return regionPathsByCode.has(value);
}

export function getChinaAdministrativeRegionPath(value: string | null | undefined): ChinaAdministrativeRegionPath | null {
  if (!value) return null;
  const path = regionPathsByCode.get(value);
  return path ? { codes: [...path.codes], names: [...path.names] } : null;
}

export function formatChinaAdministrativeRegion(value: string | null | undefined): string | null {
  const names = getChinaAdministrativeRegionPath(value)?.names;
  if (!names) return null;
  return names.filter((name, index) => index === 0 || name !== names[index - 1]).join(' / ');
}
