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

function normalizeChineseAdministrativeRegionPath(value: string) {
  return value
    .replace(/[／/｜|、，,;；>＞]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatChinaAdministrativeRegionPath(path: { names: string[] }) {
  return path.names.filter((name: string, index: number) => index === 0 || name !== path.names[index - 1]).join(' / ');
}

const regionPathsByCode = new Map<string, ChinaAdministrativeRegionPath>();
const canonicalChinesePathByNormalizedInput = new Map<string, string>();

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
    const canonicalPath = formatChinaAdministrativeRegionPath(path);
    canonicalChinesePathByNormalizedInput.set(normalizeChineseAdministrativeRegionPath(canonicalPath), canonicalPath);
    canonicalChinesePathByNormalizedInput.set(normalizeChineseAdministrativeRegionPath(path.names.join('')), canonicalPath);
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
  const path = getChinaAdministrativeRegionPath(value);
  return path ? formatChinaAdministrativeRegionPath(path) : null;
}

/** Returns the canonical full Chinese administrative path for a legacy code. */
export function getChinaAdministrativeRegionNameFromCode(value: string | null | undefined): string | null {
  return formatChinaAdministrativeRegion(value);
}

/**
 * Accepts a canonical Chinese path (for example “湖北省 / 武汉市 / 洪山区”)
 * or the same known hierarchy without separators, and returns its canonical path.
 * A terminal name alone is deliberately not accepted because it can be ambiguous.
 */
export function normalizeChinaAdministrativeRegionName(value: string | null | undefined): string | null {
  if (!value) return null;
  return canonicalChinesePathByNormalizedInput.get(normalizeChineseAdministrativeRegionPath(value)) ?? null;
}

/** Prefer a stored Chinese path and fall back to legacy code conversion. */
export function displayChinaAdministrativeRegion(
  name: string | null | undefined,
  legacyCode: string | null | undefined,
): string | null {
  return normalizeChinaAdministrativeRegionName(name) ?? getChinaAdministrativeRegionNameFromCode(legacyCode);
}
