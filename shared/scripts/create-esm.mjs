import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
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
  'GENDERS',
  'CONTRACT_TERM_TYPES',
  'AGREEMENT_TYPES',
  'PERSONNEL_FIELDS',
  'PERSONNEL_FIELD_CONTRACT_VERSION',
  'PERMISSIONS',
]) {
  const match = typeOnlySource.match(new RegExp(`export const ${name} = ([\\s\\S]*?) as const;`));
  if (!match) throw new Error(`Unable to find ${name} in shared source`);
  values[name] = match[1];
}

await writeFile(
  new URL('../dist/index.mjs', import.meta.url),
  `${Object.entries(values).map(([name, value]) => `export const ${name} = ${value};`).join('\n\n')}\n`,
);
