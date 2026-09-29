-- CreateEnum
CREATE TYPE "ApprovalFlowDefinitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApprovalFlowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ApprovalFlowNodeAssigneeKind" AS ENUM ('USER', 'ROLE', 'DIRECTORY');

-- CreateEnum
CREATE TYPE "EmploymentConversionType" AS ENUM ('INTERN_TO_EMPLOYEE', 'LABOR_TO_EMPLOYEE');

-- CreateEnum
CREATE TYPE "EmploymentApplicationStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'PENDING_EFFECTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PartTimeRecordStatus" AS ENUM ('DRAFT', 'PENDING', 'REJECTED', 'WITHDRAWN', 'PENDING_EFFECTIVE', 'ACTIVE', 'ENDED', 'CANCELLED');

-- AlterTable
ALTER TABLE "approval_requests"
ADD COLUMN "employment_status" "EmploymentApplicationStatus",
ADD COLUMN "flow_version_id" TEXT;

-- CreateTable
CREATE TABLE "approval_flow_definitions" (
    "id" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ApprovalFlowDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flow_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_versions" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "ApprovalFlowVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flow_nodes" (
    "id" TEXT NOT NULL,
    "flow_version_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "assignee_kind" "ApprovalFlowNodeAssigneeKind" NOT NULL,
    "assignee_user_id" TEXT,
    "assignee_role_id" TEXT,
    "assignee_rule" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flow_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_conversions" (
    "id" TEXT NOT NULL,
    "type" "EmploymentConversionType" NOT NULL,
    "employee_id" TEXT NOT NULL,
    "source_employment_period_id" TEXT NOT NULL,
    "target_organization_id" TEXT NOT NULL,
    "target_position_id" TEXT,
    "target_job_title_id" TEXT,
    "target_job_level" "JobLevelCode",
    "planned_effective_date" DATE NOT NULL,
    "approval_request_id" TEXT,
    "status" "EmploymentApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "source_snapshot" JSONB NOT NULL,
    "target_snapshot" JSONB NOT NULL,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_time_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "type" VARCHAR(64) NOT NULL,
    "institution" VARCHAR(191),
    "organization_id" TEXT NOT NULL,
    "job_title_id" TEXT,
    "manager_employee_id" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "PartTimeRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "approval_request_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "part_time_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approval_flow_definitions_business_type_idx" ON "approval_flow_definitions"("business_type");

-- Only one definition is currently published for a business type. Archived
-- definitions remain available as history and can be replaced.
CREATE UNIQUE INDEX "approval_flow_definitions_published_business_type_key"
ON "approval_flow_definitions" ("business_type")
WHERE "status" = 'PUBLISHED';

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_definitions_code_key" ON "approval_flow_definitions"("code");

-- CreateIndex
CREATE INDEX "approval_flow_definitions_status_archived_at_idx" ON "approval_flow_definitions"("status", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_versions_definition_id_version_number_key" ON "approval_flow_versions"("definition_id", "version_number");

-- CreateIndex
CREATE INDEX "approval_flow_versions_definition_id_status_idx" ON "approval_flow_versions"("definition_id", "status");

-- Exactly one version is current for a definition. Publishing a new version
-- archives the previously published version in the same transaction.
CREATE UNIQUE INDEX "approval_flow_versions_published_definition_key"
ON "approval_flow_versions" ("definition_id")
WHERE "status" = 'PUBLISHED';

-- CreateIndex
CREATE UNIQUE INDEX "approval_flow_nodes_flow_version_id_step_order_key" ON "approval_flow_nodes"("flow_version_id", "step_order");

-- CreateIndex
CREATE INDEX "approval_flow_nodes_assignee_user_id_idx" ON "approval_flow_nodes"("assignee_user_id");

-- CreateIndex
CREATE INDEX "approval_flow_nodes_assignee_role_id_idx" ON "approval_flow_nodes"("assignee_role_id");

-- CreateIndex
CREATE UNIQUE INDEX "employment_conversions_approval_request_id_key" ON "employment_conversions"("approval_request_id");

-- CreateIndex
CREATE INDEX "employment_conversions_source_employment_period_id_status_a_idx" ON "employment_conversions"("source_employment_period_id", "status", "archived_at");

-- CreateIndex
CREATE INDEX "employment_conversions_employee_id_status_planned_effective_idx" ON "employment_conversions"("employee_id", "status", "planned_effective_date");

-- CreateIndex
CREATE INDEX "employment_conversions_target_organization_id_status_planne_idx" ON "employment_conversions"("target_organization_id", "status", "planned_effective_date");

-- A source employment period can have only one open conversion. Terminal rows
-- and archived attempts remain available as history.
CREATE UNIQUE INDEX "employment_conversions_open_source_period_key"
ON "employment_conversions" ("source_employment_period_id")
WHERE "archived_at" IS NULL
  AND "status" IN ('DRAFT', 'PENDING', 'APPROVED', 'PENDING_EFFECTIVE');

-- CreateIndex
CREATE UNIQUE INDEX "part_time_records_approval_request_id_key" ON "part_time_records"("approval_request_id");

-- Date interval overlap is validated transactionally by the service. A normal
-- lookup index supports that query; a partial unique index cannot enforce ranges.
CREATE INDEX "part_time_records_overlap_lookup_idx" ON "part_time_records"("employee_id", "institution", "organization_id", "job_title_id", "status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "part_time_records_organization_id_status_start_date_end_dat_idx" ON "part_time_records"("organization_id", "status", "start_date", "end_date");

-- CreateIndex
CREATE INDEX "part_time_records_manager_employee_id_status_idx" ON "part_time_records"("manager_employee_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_flow_version_id_idx" ON "approval_requests"("flow_version_id");

-- CreateIndex
CREATE INDEX "approval_requests_employment_status_idx" ON "approval_requests"("employment_status");

-- AddForeignKey
ALTER TABLE "approval_flow_versions" ADD CONSTRAINT "approval_flow_versions_definition_id_fkey" FOREIGN KEY ("definition_id") REFERENCES "approval_flow_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_nodes" ADD CONSTRAINT "approval_flow_nodes_flow_version_id_fkey" FOREIGN KEY ("flow_version_id") REFERENCES "approval_flow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_nodes" ADD CONSTRAINT "approval_flow_nodes_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_flow_nodes" ADD CONSTRAINT "approval_flow_nodes_assignee_role_id_fkey" FOREIGN KEY ("assignee_role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_flow_version_id_fkey" FOREIGN KEY ("flow_version_id") REFERENCES "approval_flow_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_conversions" ADD CONSTRAINT "employment_conversions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_conversions" ADD CONSTRAINT "employment_conversions_source_employment_period_id_fkey" FOREIGN KEY ("source_employment_period_id") REFERENCES "employment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_conversions" ADD CONSTRAINT "employment_conversions_target_organization_id_fkey" FOREIGN KEY ("target_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_conversions" ADD CONSTRAINT "employment_conversions_target_position_id_fkey" FOREIGN KEY ("target_position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_conversions" ADD CONSTRAINT "employment_conversions_target_job_title_id_fkey" FOREIGN KEY ("target_job_title_id") REFERENCES "job_titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_conversions" ADD CONSTRAINT "employment_conversions_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_time_records" ADD CONSTRAINT "part_time_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_time_records" ADD CONSTRAINT "part_time_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_time_records" ADD CONSTRAINT "part_time_records_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "job_titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_time_records" ADD CONSTRAINT "part_time_records_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_time_records" ADD CONSTRAINT "part_time_records_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Install the employment-business permission catalog because this migration is
-- deployable independently and the destructive demo seed is intentionally not run.
INSERT INTO "permissions" ("id", "code", "name", "created_at", "updated_at")
VALUES
    ('employment-permission-movement-manage', 'employment.movement.manage', '管理任职异动', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('employment-permission-termination-force', 'employment.termination.force', '执行强制离职', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('employment-permission-reporting-adjust', 'employment.reporting.adjust', '调整汇报关系', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('employment-permission-approval-flow-manage', 'employment.approval-flow.manage', '管理任职审批流程', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('employment-permission-export', 'employment.export', '导出任职数据', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "updated_at" = CURRENT_TIMESTAMP;
