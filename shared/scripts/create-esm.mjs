import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const positionCatalogSource = await readFile(new URL('../src/position-catalog.ts', import.meta.url), 'utf8');
const organizationCatalogSource = await readFile(new URL('../src/organization-catalog.ts', import.meta.url), 'utf8');
const regionCatalogSource = await readFile(new URL('../src/china-administrative-regions.ts', import.meta.url), 'utf8');
const regionCatalogData = await readFile(new URL('../src/china-administrative-regions.data.json', import.meta.url), 'utf8');
const positionCatalogModule = positionCatalogSource
  .replace(/export\s+interface\s+PositionCatalogEntry\s*\{[\s\S]*?\}\s*/, '')
  .replace(/export\s+type\s+PositionCatalogEntry[\s\S]*?;\s*/, '')
  .replace('] as const satisfies readonly PositionCatalogEntry[];', '];')
  .replace('(entry: PositionCatalogEntry, query: string)', '(entry, query)')
  .replace('(query: string)', '(query)');
const values = {};
const typeOnlySource = source.replace(/export (?:interface|type) [\s\S]*?(?=export (?:const|interface|type) |$)/g, '');
for (const name of [
  'ROLE_CODES',
  'EMPLOYMENT_STATUSES',
  'PERSONNEL_CATEGORIES',
  'EMPLOYMENT_RELATIONSHIPS',
  'PERSONNEL_SOURCES',
  'PERSONNEL_POSITIONS',
  'EMPLOYEE_LEVELS',
  'JOB_LEVELS',
  'WORK_ARRANGEMENTS',
  'HOUSEHOLD_TYPES',
  'BANK_NAMES',
  'EDUCATION_LEVELS',
  'INSTITUTION_TYPES',
  'MARITAL_STATUSES',
  'POLITICAL_STATUSES',
  'ETHNICITIES',
  'IDENTITY_DOCUMENT_TYPES',
  'IDENTITY_DOCUMENT_TYPE_LABELS',
  'GENDERS',
  'CONTRACT_TERM_TYPES',
  'AGREEMENT_TYPES',
  'PERSONNEL_FIELDS',
  'PERSONNEL_FIELD_CONTRACT_VERSION',
  'PERMISSIONS',
]) {
  const match = typeOnlySource.match(new RegExp(`export const ${name} = ([\\s\\S]*?)(?: as const(?: satisfies [^;]+)?)?;`));
  if (!match) throw new Error(`Unable to find ${name} in shared source`);
  values[name] = match[1];
}

const organizationCatalogModule = organizationCatalogSource
  .replace(/export\s+interface\s+OrganizationCatalogEntry\s*\{[\s\S]*?\}\s*/, '')
  .replace('] as const satisfies readonly OrganizationCatalogEntry[];', '];');
const regionCatalogModule = regionCatalogSource
  .replace("import chinaAdministrativeRegionsData from './china-administrative-regions.data.json';", `const chinaAdministrativeRegionsData = ${regionCatalogData};`)
  .replace(/export\s+interface\s+ChinaAdministrativeRegion\s*\{[\s\S]*?\}\s*/, '')
  .replace(/export\s+interface\s+ChinaAdministrativeRegionPath\s*\{[\s\S]*?\}\s*/, '')
  .replace(/export\s+interface\s+ChinaAdministrativeRegionCascaderOption\s*\{[\s\S]*?\}\s*/, '')
  .replaceAll('export const ', 'const ')
  .replaceAll('export function ', 'function ')
  .replace('chinaAdministrativeRegionsData as ChinaAdministrativeRegion[]', 'chinaAdministrativeRegionsData')
  .replace('new Map<string, ChinaAdministrativeRegionPath>()', 'new Map()')
  .replace(/regions: readonly ChinaAdministrativeRegion\[\]/g, 'regions')
  .replace(/: ChinaAdministrativeRegionCascaderOption\[\]/g, '')
  .replace(/parentPath: ChinaAdministrativeRegionPath =/g, 'parentPath =')
  .replace(/region: ChinaAdministrativeRegion/g, 'region')
  .replace(/value: string \| null \| undefined/g, 'value')
  .replace(/value: string/g, 'value')
  .replace(/: ChinaAdministrativeRegionPath \| null/g, '')
  .replace(/: string \| null/g, '')
  .replace(/: ChinaAdministrativeRegionCascaderOption/g, '')
  .replace(/: boolean/g, '');

await writeFile(
  new URL('../dist/index.mjs', import.meta.url),
  `${positionCatalogModule}\n\n${organizationCatalogModule}\n\n${regionCatalogModule}\n\nexport { CHINA_ADMINISTRATIVE_REGIONS, CHINA_ADMINISTRATIVE_REGION_OPTIONS, formatChinaAdministrativeRegion, getChinaAdministrativeRegionPath, isChinaAdministrativeRegionCode };\n\n${Object.entries(values).map(([name, value]) => `export const ${name} = ${value};`).join('\n\n')}\n`,
);
