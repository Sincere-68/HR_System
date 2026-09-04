import type { Prisma } from '@prisma/client';

export interface DirectoryValue {
  id: string;
  code: string;
  label: string;
}

export interface FieldChange {
  field: string;
  oldValue: Prisma.InputJsonValue | null;
  newValue: Prisma.InputJsonValue | null;
}

function normalizeJson(value: unknown): Prisma.InputJsonValue | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function directoryValue(
  value: { id: string; name: string; code?: string } | null | undefined,
): Prisma.InputJsonValue | null {
  if (!value) return null;
  return { id: value.id, ...(value.code ? { code: value.code } : {}), label: value.name };
}

export function enumValue(
  code: string | null | undefined,
  label: string | null | undefined,
): Prisma.InputJsonValue | null {
  if (!code) return null;
  return { code, label: label ?? code };
}

export function collectFieldChanges(
  dto: Record<string, unknown>,
  currentValues: Record<string, unknown>,
) {
  const changes: FieldChange[] = [];
  for (const [field, newValue] of Object.entries(dto)) {
    if (newValue === undefined) continue;
    const oldValue = currentValues[field];
    const normalizedOld = normalizeJson(oldValue);
    const normalizedNew = normalizeJson(newValue);
    if (JSON.stringify(normalizedOld) === JSON.stringify(normalizedNew)) continue;
    changes.push({ field, oldValue: normalizedOld, newValue: normalizedNew });
  }
  return changes;
}
