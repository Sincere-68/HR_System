import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const schemaPath = resolve(__dirname, '../../prisma/schema.prisma');
const migrationPath = resolve(
  __dirname,
  '../../prisma/migrations/20260918190000_employment_business_foundation/migration.sql',
);

const schema = readFileSync(schemaPath, 'utf8');
const migration = existsSync(migrationPath)
  ? readFileSync(migrationPath, 'utf8')
  : '';

function block(source: string, kind: 'enum' | 'model', name: string): string {
  const marker = `${kind} ${name} {`;
  const start = source.indexOf(marker);
  if (start === -1) {
    return '';
  }

  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') {
      depth += 1;
    } else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }

  return '';
}

function enumValues(name: string): string[] {
  const enumBlock = block(schema, 'enum', name);
  if (!enumBlock) {
    return [];
  }

  return enumBlock
    .split('\n')
    .slice(1, -1)
    .map((line) => line.replace(/\/\/.*$/, '').trim())
    .filter(Boolean);
}

describe('employment business Prisma foundation', () => {
  it('defines dedicated workflow and employment lifecycle enums without changing ProcessStatus', () => {
    expect(enumValues('ApprovalFlowDefinitionStatus')).toEqual([
      'DRAFT',
      'PUBLISHED',
      'ARCHIVED',
    ]);
    expect(enumValues('ApprovalFlowVersionStatus')).toEqual([
      'DRAFT',
      'PUBLISHED',
      'ARCHIVED',
    ]);
    expect(enumValues('ApprovalFlowNodeAssigneeKind')).toEqual([
      'USER',
      'ROLE',
      'DIRECTORY',
    ]);
    expect(enumValues('EmploymentConversionType')).toEqual([
      'INTERN_TO_EMPLOYEE',
      'LABOR_TO_EMPLOYEE',
    ]);
    expect(enumValues('EmploymentApplicationStatus')).toEqual([
      'DRAFT',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'WITHDRAWN',
      'PENDING_EFFECTIVE',
      'COMPLETED',
      'CANCELLED',
    ]);
    expect(enumValues('PartTimeRecordStatus')).toEqual([
      'DRAFT',
      'PENDING',
      'REJECTED',
      'WITHDRAWN',
      'PENDING_EFFECTIVE',
      'ACTIVE',
      'ENDED',
      'CANCELLED',
    ]);
    expect(enumValues('ProcessStatus')).toEqual([
      'DRAFT',
      'PENDING',
      'APPROVED',
      'REJECTED',
      'WITHDRAWN',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED',
    ]);
  });

  it('models immutable sequential approval flow versions and explicit assignees', () => {
    const definition = block(schema, 'model', 'ApprovalFlowDefinition');
    const version = block(schema, 'model', 'ApprovalFlowVersion');
    const node = block(schema, 'model', 'ApprovalFlowNode');
    const request = block(schema, 'model', 'ApprovalRequest');

    // Guard the parser itself with a pre-existing field before checking additions.
    expect(request).toContain('applicantUserId');
    expect(definition).toContain('businessType');
    expect(definition).not.toMatch(/businessType\s+String\s+@unique/);
    expect(definition).toContain('code');
    expect(definition).toContain('name');
    expect(definition).toContain('status');
    expect(definition).toContain('versions');
    expect(definition).toContain('@@index([businessType])');
    expect(definition).toContain('@@map("approval_flow_definitions")');

    expect(version).toContain('definitionId');
    expect(version).toContain('versionNumber');
    expect(version).toContain('publishedAt');
    expect(version).toContain('nodes');
    expect(version).toContain('approvalRequests');
    expect(version).toContain('@@unique([definitionId, versionNumber])');
    expect(version).toContain('@@map("approval_flow_versions")');

    expect(node).toContain('flowVersionId');
    expect(node).toContain('stepOrder');
    expect(node).toContain('assigneeKind');
    expect(node).toContain('assigneeUserId');
    expect(node).toContain('assigneeRoleId');
    expect(node).toContain('assigneeRule');
    expect(node).toContain('Json?');
    expect(node).toContain('onDelete: Restrict');
    expect(migration).toContain(
      'CREATE TYPE "ApprovalFlowNodeAssigneeKind" AS ENUM (\'USER\', \'ROLE\', \'DIRECTORY\');',
    );
    expect(migration).toContain('"assignee_rule" JSONB');
    expect(node).toContain('@@unique([flowVersionId, stepOrder])');
    expect(node).toContain('@@map("approval_flow_nodes")');

    expect(request).toContain('flowVersionId');
    expect(request).toContain('flowVersion');
    expect(request).toMatch(
      /employmentStatus\s+EmploymentApplicationStatus\?\s+@map\("employment_status"\)/,
    );
    expect(request).toContain('@@index([flowVersionId])');
    expect(request).toContain('@@index([employmentStatus])');
  });

  it('models conversion snapshots and independent part-time records with safe relations', () => {
    const conversion = block(schema, 'model', 'EmploymentConversion');
    const partTime = block(schema, 'model', 'PartTimeRecord');

    for (const field of [
      'type',
      'employeeId',
      'sourceEmploymentPeriodId',
      'targetOrganizationId',
      'targetPositionId',
      'targetJobTitleId',
      'targetJobLevel',
      'plannedEffectiveDate',
      'approvalRequestId',
      'status',
      'sourceSnapshot',
      'targetSnapshot',
      'archivedAt',
    ]) {
      expect(conversion).toContain(field);
    }
    expect(conversion).toContain('EmploymentApplicationStatus');
    expect(conversion).toMatch(
      /approvalRequest\s+ApprovalRequest\?\s+@relation\(fields: \[approvalRequestId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(conversion).toContain('@@map("employment_conversions")');

    for (const field of [
      'employeeId',
      'type',
      'institution',
      'organizationId',
      'jobTitleId',
      'managerEmployeeId',
      'startDate',
      'endDate',
      'status',
      'approvalRequestId',
      'archivedAt',
    ]) {
      expect(partTime).toContain(field);
    }
    expect(partTime).toContain('PartTimeRecordStatus');
    expect(partTime).toMatch(
      /approvalRequest\s+ApprovalRequest\?\s+@relation\(fields: \[approvalRequestId\], references: \[id\], onDelete: Restrict\)/,
    );
    expect(partTime).toContain('part_time_records_overlap_lookup_idx');
    expect(partTime).toContain('@@map("part_time_records")');
  });

  it('adds every inverse relation needed by the new records', () => {
    expect(block(schema, 'model', 'Role')).toContain('approvalFlowNodes');
    expect(block(schema, 'model', 'User')).toContain('approvalFlowNodes');
    expect(block(schema, 'model', 'Employee')).toContain('employmentConversions');
    expect(block(schema, 'model', 'Employee')).toContain('partTimeRecords');
    expect(block(schema, 'model', 'Employee')).toContain('managedPartTimeRecords');
    expect(block(schema, 'model', 'EmploymentPeriod')).toContain('sourceEmploymentConversions');
    expect(block(schema, 'model', 'Organization')).toContain('targetEmploymentConversions');
    expect(block(schema, 'model', 'Organization')).toContain('partTimeRecords');
    expect(block(schema, 'model', 'Position')).toContain('targetEmploymentConversions');
    expect(block(schema, 'model', 'JobTitle')).toContain('targetEmploymentConversions');
    expect(block(schema, 'model', 'JobTitle')).toContain('partTimeRecords');
  });

  it('installs the approved employment permission catalog without requiring seed execution', () => {
    const permissionCodes = [
      'employment.movement.manage',
      'employment.termination.force',
      'employment.reporting.adjust',
      'employment.approval-flow.manage',
      'employment.export',
    ] as const;
    const permissionInsert = migration.match(
      /INSERT INTO "permissions" \("id", "code", "name", "created_at", "updated_at"\)[\s\S]*?ON CONFLICT \("code"\) DO UPDATE SET "name" = EXCLUDED\."name", "updated_at" = CURRENT_TIMESTAMP;/,
    )?.[0];

    expect(permissionInsert).toBeDefined();
    for (const code of permissionCodes) {
      expect(permissionInsert).toContain(`'${code}'`);
    }
  });

  it('uses additive SQL, restrictive foreign keys, and the required partial uniqueness guards', () => {
    expect(migration).toContain('CREATE TABLE "approval_flow_definitions"');
    expect(migration).toContain('CREATE TABLE "approval_flow_versions"');
    expect(migration).toContain('CREATE TABLE "approval_flow_nodes"');
    expect(migration).toContain('CREATE TABLE "employment_conversions"');
    expect(migration).toContain('CREATE TABLE "part_time_records"');
    expect(migration).toMatch(
      /ALTER TABLE "approval_requests"\s+ADD COLUMN "employment_status" "EmploymentApplicationStatus",\s+ADD COLUMN "flow_version_id" TEXT;/,
    );

    expect(migration).not.toContain(
      'CREATE UNIQUE INDEX "approval_flow_definitions_business_type_key"',
    );
    expect(migration).toContain(
      'CREATE INDEX "approval_flow_definitions_business_type_idx" ON "approval_flow_definitions"("business_type");',
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "approval_flow_definitions_published_business_type_key"[\s\S]*?ON "approval_flow_definitions" \("business_type"\)[\s\S]*?WHERE "status" = 'PUBLISHED';/,
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "approval_flow_versions_published_definition_key"[\s\S]*?ON "approval_flow_versions" \("definition_id"\)[\s\S]*?WHERE "status" = 'PUBLISHED';/,
    );
    expect(migration).toMatch(
      /CREATE UNIQUE INDEX "employment_conversions_open_source_period_key"[\s\S]*?ON "employment_conversions" \("source_employment_period_id"\)[\s\S]*?WHERE "archived_at" IS NULL[\s\S]*?AND "status" IN \('DRAFT', 'PENDING', 'APPROVED', 'PENDING_EFFECTIVE'\);/,
    );
    expect(migration).toMatch(
      /CREATE INDEX "part_time_records_overlap_lookup_idx"[\s\S]*?ON "part_time_records"/,
    );
    expect(migration).not.toMatch(
      /CREATE UNIQUE INDEX "part_time_records_overlap_lookup_idx"/,
    );

    expect(migration).toMatch(
      /approval_flow_nodes_flow_version_id_fkey[\s\S]*?ON DELETE RESTRICT/,
    );
    expect(migration).toMatch(
      /employment_conversions_source_employment_period_id_fkey[\s\S]*?ON DELETE RESTRICT/,
    );
    expect(migration).toMatch(
      /employment_conversions_approval_request_id_fkey[\s\S]*?ON DELETE RESTRICT/,
    );
    expect(migration).toMatch(
      /part_time_records_employee_id_fkey[\s\S]*?ON DELETE RESTRICT/,
    );
    expect(migration).toMatch(
      /part_time_records_approval_request_id_fkey[\s\S]*?ON DELETE RESTRICT/,
    );
    expect(migration).toContain(
      'CREATE INDEX "approval_requests_employment_status_idx" ON "approval_requests"("employment_status");',
    );
    expect(migration).not.toMatch(/^\s*(?:DROP\b|DELETE\s+FROM\b|TRUNCATE\b)/im);
  });
});
