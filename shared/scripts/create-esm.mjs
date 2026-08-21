import { readFile, writeFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/index.ts', import.meta.url), 'utf8');
const values = {};
for (const name of ['ROLE_CODES', 'EMPLOYMENT_STATUSES', 'PERMISSIONS']) {
  const match = source.match(new RegExp(`export const ${name} = ([\\s\\S]*?) as const;`));
  if (!match) throw new Error(`Unable to find ${name} in shared source`);
  values[name] = match[1];
}

await writeFile(
  new URL('../dist/index.mjs', import.meta.url),
  `${Object.entries(values).map(([name, value]) => `export const ${name} = ${value};`).join('\n\n')}\n`,
);
