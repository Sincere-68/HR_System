-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PROBATION', 'REGULAR', 'PENDING_ENTRY', 'TRANSFERRED_OUT', 'PENDING_TRANSFER_IN', 'RETIRED', 'RESIGNED', 'NON_REGULAR');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('DETAIL_VIEW', 'CREATE', 'UPDATE', 'EXPORT');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PersonnelCategory" AS ENUM ('TALENT_PROGRAM', 'NON_TALENT_PROGRAM');

-- CreateEnum
CREATE TYPE "EmploymentRelationship" AS ENUM ('INTERNAL_EMPLOYEE', 'INTERN', 'LABOR_WORKER');

-- CreateEnum
CREATE TYPE "PersonnelSource" AS ENUM ('SOCIAL_RECRUITMENT', 'INTERNAL_REFERRAL', 'HEADHUNTER_REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "PersonnelPosition" AS ENUM ('FRONT_OFFICE', 'MIDDLE_OFFICE', 'BACK_OFFICE');

-- CreateEnum
CREATE TYPE "EmployeeLevel" AS ENUM ('STAFF', 'SUPERVISOR', 'MANAGER', 'DIRECTOR', 'PRESIDENT', 'EXPERT');

-- CreateEnum
CREATE TYPE "JobLevelCode" AS ENUM ('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7');

-- CreateEnum
CREATE TYPE "HouseholdType" AS ENUM ('LOCAL_RURAL', 'LOCAL_URBAN', 'NONLOCAL_RURAL', 'NONLOCAL_URBAN');

-- CreateEnum
CREATE TYPE "BankName" AS ENUM ('ICBC');

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('DOCTORAL', 'MASTER', 'MBA', 'BACHELOR', 'DUAL_BACHELOR', 'ASSOCIATE_DEGREE', 'OVERSEAS_HIGHER_EDUCATION', 'SECONDARY_TECHNICAL', 'HIGH_SCHOOL', 'JUNIOR_HIGH_OR_BELOW');

-- CreateEnum
CREATE TYPE "InstitutionType" AS ENUM ('RANK_985', 'RANK_211', 'OVERSEAS_TOP_200', 'OVERSEAS_BEYOND_TOP_100', 'NATIONAL_UNIFIED_BACHELOR', 'THIRD_TIER_OR_PRIVATE_BACHELOR', 'NON_UNIFIED_BACHELOR');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('UNMARRIED', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "PoliticalStatus" AS ENUM ('NON_PARTY', 'CPC_MEMBER', 'CPC_PROBATIONARY_MEMBER', 'CYL_MEMBER', 'CDF_MEMBER', 'CDL_MEMBER', 'CDCA_MEMBER', 'CAPD_MEMBER', 'CPWDP_MEMBER', 'ZGD_MEMBER', 'JDS_MEMBER', 'TML_MEMBER', 'NONPARTISAN', 'OTHER');

-- CreateEnum
CREATE TYPE "Ethnicity" AS ENUM ('HAN', 'HUI', 'SHE', 'TATAR', 'ACHANG', 'KAZAKH', 'TUJIA', 'JINGPO', 'HANI', 'TU', 'BAI', 'UYGHUR', 'BONAN', 'HEZHEN', 'UZBEK', 'JINO', 'BUYI', 'LAHU', 'XIBE', 'LI', 'DONGXIANG', 'MONGOL', 'MULAO', 'DAUR', 'TIBETAN', 'MAONAN', 'YUGUR', 'RUSSIAN', 'DEANG', 'LISU', 'YAO', 'KOREAN', 'BLANG', 'MANCHU', 'YI', 'MONBA', 'DONG', 'MIAO', 'WA', 'QIANG', 'DERUNG', 'NU', 'LHOBA', 'PUMI', 'DAI', 'NAXI', 'GAOSHAN', 'ZHUANG', 'OROQEN', 'TAJIK', 'JING', 'GELAO', 'EVENKI', 'SALAR', 'KYRGYZ', 'SHUI', 'CHUANQING', 'OTHER', 'GE', 'GEJIA');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'UNDISCLOSED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('PRIMARY', 'ADDITIONAL', 'TEMPORARY');

-- CreateEnum
CREATE TYPE "WorkArrangement" AS ENUM ('PART_TIME', 'LABOR_DISPATCH', 'CONTRACT_EMPLOYMENT', 'LABOR_EMPLOYMENT', 'INTERN', 'RETIREE_REEMPLOYMENT');

-- CreateEnum
CREATE TYPE "ReportingRelationshipType" AS ENUM ('ADMINISTRATIVE', 'BUSINESS', 'PROJECT', 'FUNCTIONAL', 'OTHER');

-- CreateEnum
CREATE TYPE "IdentityDocumentType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'HK_MACAO_PERMIT', 'TAIWAN_PERMIT', 'MILITARY_ID', 'ARMED_POLICE_OFFICER_ID', 'HK_MACAO_ID', 'FOREIGN_PASSPORT', 'HK_PERMANENT_ID', 'TAIWAN_ID', 'MACAO_PERMANENT_ID', 'FOREIGN_PERMANENT_RESIDENCE_ID', 'MACAO_NON_PERMANENT_ID', 'HK_ID', 'THAILAND_ID', 'MALAYSIA_ID', 'VIETNAM_ID', 'INDONESIA_ID', 'HK_MACAO_RESIDENCE_PERMIT', 'TAIWAN_RESIDENCE_PERMIT', 'MEXICO_ID', 'SINGAPORE_ID', 'SINGAPORE_PR', 'SINGAPORE_EP', 'SINGAPORE_WP', 'SINGAPORE_SP', 'SINGAPORE_LOC', 'SINGAPORE_PLOC', 'SINGAPORE_STUDENT_PASS', 'PHILIPPINES_ID', 'HK_MACAO_NON_CHINESE_PERMIT', 'US_SSN', 'CANADA_SIN', 'MALAYSIA_OLD_ID', 'MALAYSIA_WP', 'MALAYSIA_PR', 'MALAYSIA_MILITARY_ID', 'MALAYSIA_POLICE_ID', 'MALAYSIA_PASSPORT', 'MALAYSIA_EP', 'MALAYSIA_PROFESSIONAL_VISIT_PASS', 'MALAYSIA_DEPENDENT_PASS', 'MALAYSIA_ENTREPRENEUR_PASS', 'MALAYSIA_TALENT_RESIDENCE_PASS', 'MALAYSIA_LONG_TERM_SOCIAL_VISIT_PASS', 'MALAYSIA_SHORT_TERM_SOCIAL_VISIT_PASS', 'MALAYSIA_FOREIGN_STUDENT_PASS', 'MALAYSIA_WORKING_HOLIDAY_PASS', 'MALAYSIA_PROFESSIONAL_TRAINING_PASS', 'MALAYSIA_TECHNICAL_TRAINING_PASS', 'IANG_VISA', 'HK_QUALITY_MIGRANT_ADMISSION_SCHEME', 'MAINLAND_TRAVEL_PERMIT_HK_MACAO', 'HK_TOP_TALENT_PASS_SCHEME', 'SINGAPORE_LONG_TERM_VISIT_PASS_SG14', 'HK_DOCUMENT_OF_IDENTITY', 'EXIT_ENTRY_PERMIT_HK_MACAO', 'SINGAPORE_ONE_PASS', 'SOUTH_KOREA_ID', 'OTHER');

-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PerformanceModuleType" AS ENUM ('METRIC', 'EVALUATION', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PerformanceExecutorType" AS ENUM ('AUTO', 'USER', 'DIRECTORY');

-- CreateEnum
CREATE TYPE "PerformanceDirectoryType" AS ENUM ('POSITION', 'JOB_TITLE');

-- CreateEnum
CREATE TYPE "PerformanceVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PerformanceAdjustmentDirection" AS ENUM ('ADD', 'DEDUCT');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AgreementType" AS ENUM ('LABOR_CONTRACT', 'LABOR_SERVICE_CONTRACT', 'INTERNSHIP_AGREEMENT', 'OTHER', 'NON_COMPETE_AGREEMENT', 'RETIREE_REEMPLOYMENT_AGREEMENT', 'NON_FULL_TIME_EMPLOYMENT_CONTRACT', 'SPECIAL_AGREEMENT', 'PART_TIME_SERVICE_AGREEMENT');

-- CreateEnum
CREATE TYPE "AgreementStatus" AS ENUM ('DRAFT', 'PENDING_SIGNATURE', 'ACTIVE', 'EXPIRED', 'TERMINATED', 'CANCELLED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parent_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "effective_date" DATE,
    "expiry_date" DATE,
    "description" TEXT,
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "archive_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_data_scopes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_data_scopes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "employee_no" TEXT NOT NULL,
    "name" TEXT,
    "former_name" TEXT,
    "english_name" TEXT,
    "gender" "Gender",
    "birth_date" DATE,
    "nationality" TEXT,
    "ethnicity" "Ethnicity",
    "native_place" TEXT,
    "native_place_region_code" VARCHAR(12),
    "political_status" "PoliticalStatus",
    "marital_status" "MaritalStatus",
    "mobile" TEXT,
    "personal_email" TEXT,
    "work_email" TEXT,
    "household_type" "HouseholdType",
    "household_region_code" VARCHAR(12),
    "household_address" TEXT,
    "residential_region_code" VARCHAR(12),
    "residential_address" TEXT,
    "bank_name" "BankName",
    "bank_branch_name" TEXT,
    "bank_account_number" VARCHAR(19),
    "profile_photo_id" TEXT,
    "record_status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "archived_by_id" TEXT,
    "archive_reason" TEXT,
    "id_card_no" TEXT,
    "organization_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employing_companies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employing_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" TEXT,
    "category" TEXT,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_titles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization_id" TEXT,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_titles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workplaces" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workplaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_periods" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "sequence_no" INTEGER NOT NULL,
    "personnel_category" "PersonnelCategory",
    "personnel_source" "PersonnelSource",
    "employment_relationship" "EmploymentRelationship" NOT NULL,
    "entry_date" DATE NOT NULL,
    "planned_exit_date" DATE,
    "actual_exit_date" DATE,
    "employment_status" "EmploymentStatus" NOT NULL DEFAULT 'REGULAR',
    "is_rehire" BOOLEAN NOT NULL DEFAULT false,
    "previous_period_id" TEXT,
    "exit_reason" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_assignments" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employment_period_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "position_id" TEXT,
    "job_level" "JobLevelCode",
    "job_title_id" TEXT,
    "workplace_id" TEXT,
    "personnel_position" "PersonnelPosition",
    "employee_level" "EmployeeLevel",
    "personnel_category" "PersonnelCategory",
    "personnel_source" "PersonnelSource",
    "employment_relationship" "EmploymentRelationship",
    "assignment_type" "AssignmentType" NOT NULL DEFAULT 'PRIMARY',
    "work_arrangement" "WorkArrangement" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "change_reason" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_relationships" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "manager_employee_id" TEXT NOT NULL,
    "relationship_type" "ReportingRelationshipType" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_identity_documents" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "document_type" "IdentityDocumentType" NOT NULL,
    "document_number" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "issuing_country" TEXT,
    "issuing_authority" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "front_attachment_id" TEXT,
    "back_attachment_id" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_identity_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employment_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employment_period_id" TEXT,
    "status" "EmploymentStatus" NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "current_flag" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "file_attachments" (
    "id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "checksum" TEXT,
    "uploaded_by_id" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_family_members" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "gender" "Gender",
    "birth_date" DATE,
    "identity_document_no" TEXT,
    "mobile" TEXT,
    "work_organization" TEXT,
    "position_name" TEXT,
    "address" TEXT,
    "is_emergency_contact" BOOLEAN NOT NULL DEFAULT false,
    "is_dependent" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_family_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_education_experiences" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "institution_type" "InstitutionType",
    "education_level" "EducationLevel" NOT NULL,
    "degree" TEXT,
    "major" TEXT,
    "study_type" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "graduation_date" DATE,
    "certificate_no" TEXT,
    "is_highest_education" BOOLEAN NOT NULL DEFAULT false,
    "is_first_education" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_education_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_work_experiences" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "department_name" TEXT,
    "position_name" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "job_description" TEXT,
    "leaving_reason" TEXT,
    "reference_name" TEXT,
    "reference_mobile" TEXT,
    "remark" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_work_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_appraisals" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "appraisal_period" TEXT NOT NULL,
    "appraisal_type" TEXT NOT NULL,
    "score" DECIMAL(8,2),
    "grade" TEXT,
    "result" TEXT,
    "evaluator_user_id" TEXT,
    "appraisal_date" DATE,
    "comment" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_appraisals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_training_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "training_name" TEXT NOT NULL,
    "training_provider" TEXT,
    "training_type" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "hours" DECIMAL(8,2),
    "result" TEXT,
    "cost" DECIMAL(12,2),
    "remark" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_training_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_awards" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "award_name" TEXT NOT NULL,
    "award_level" TEXT,
    "awarding_organization" TEXT,
    "award_date" DATE,
    "reason" TEXT,
    "remark" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_awards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_certificates" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "certificate_type" TEXT NOT NULL,
    "certificate_name" TEXT NOT NULL,
    "certificate_no" TEXT,
    "issuing_authority" TEXT,
    "issue_date" DATE,
    "expiry_date" DATE,
    "attachment_id" TEXT,
    "remark" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_project_experiences" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "project_name" TEXT NOT NULL,
    "company_name" TEXT,
    "project_role" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "project_description" TEXT,
    "responsibilities" TEXT,
    "project_result" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_project_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_skills" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "skill_name" TEXT NOT NULL,
    "skill_category" TEXT,
    "proficiency_level" TEXT,
    "years_of_experience" DECIMAL(5,2),
    "is_certified" BOOLEAN NOT NULL DEFAULT false,
    "remark" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_language_abilities" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "listening_level" TEXT,
    "speaking_level" TEXT,
    "reading_level" TEXT,
    "writing_level" TEXT,
    "certificate_name" TEXT,
    "certificate_score" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_language_abilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_documents" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "document_type" TEXT NOT NULL,
    "document_name" TEXT NOT NULL,
    "attachment_id" TEXT NOT NULL,
    "expiry_date" DATE,
    "remark" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_blacklist_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT,
    "name" TEXT NOT NULL,
    "document_type" "IdentityDocumentType",
    "document_number" TEXT,
    "mobile" TEXT,
    "reason" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "expiry_date" DATE,
    "created_by_id" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_blacklist_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mobile" TEXT,
    "email" TEXT,
    "gender" "Gender",
    "birth_date" DATE,
    "work_start_date" DATE,
    "source" TEXT,
    "resume_attachment_id" TEXT,
    "converted_employee_id" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_identity_documents" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "document_type" "IdentityDocumentType" NOT NULL,
    "document_number" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "expiry_date" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_identity_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candidate_education_experiences" (
    "id" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "school_name" TEXT NOT NULL,
    "education_level" "EducationLevel" NOT NULL,
    "major" TEXT,
    "graduation_date" DATE,
    "is_highest_education" BOOLEAN NOT NULL DEFAULT false,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candidate_education_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "offer_no" TEXT NOT NULL,
    "candidate_id" TEXT NOT NULL,
    "accepted_employee_id" TEXT,
    "organization_id" TEXT,
    "position_id" TEXT,
    "workplace_id" TEXT,
    "direct_manager_employee_id" TEXT,
    "job_level" "JobLevelCode",
    "employee_level" "EmployeeLevel",
    "personnel_category" "PersonnelCategory",
    "work_arrangement" "WorkArrangement",
    "employing_company_id" TEXT,
    "agreement_type" "AgreementType",
    "contract_term_type" VARCHAR(32),
    "contract_months" INTEGER,
    "contract_end_date" DATE,
    "is_separately_signed" BOOLEAN,
    "employment_relationship" "EmploymentRelationship" NOT NULL,
    "proposed_entry_date" DATE,
    "probation_months" INTEGER,
    "offered_monthly_salary" DECIMAL(12,2),
    "issue_date" DATE,
    "expiry_date" DATE,
    "accepted_at" TIMESTAMP(3),
    "rejected_reason" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_compensation_snapshots" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "salary_package" TEXT,
    "salary_remark" TEXT,
    "pre_confirmation_base_salary" DECIMAL(12,2),
    "post_confirmation_base_salary" DECIMAL(12,2),
    "pre_confirmation_monthly_performance" DECIMAL(12,2),
    "post_confirmation_monthly_performance" DECIMAL(12,2),
    "pre_confirmation_monthly_management_performance" DECIMAL(12,2),
    "post_confirmation_monthly_management_performance" DECIMAL(12,2),
    "full_time_contract_salary" DECIMAL(12,2),
    "annual_performance" DECIMAL(12,2),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_compensation_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_part_time_snapshots" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "position_name" TEXT,
    "hourly_rate" DECIMAL(12,2),
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "offer_part_time_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_cases" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "offer_id" TEXT,
    "planned_entry_date" DATE NOT NULL,
    "actual_entry_date" DATE,
    "owner_user_id" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "completed_at" TIMESTAMP(3),
    "remark" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_tasks" (
    "id" TEXT NOT NULL,
    "onboarding_case_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "responsible_user_id" TEXT,
    "due_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_integration_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "plan_name" TEXT NOT NULL,
    "mentor_employee_id" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "feedback" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "onboarding_integration_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_introductions" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "published_at" TIMESTAMP(3),
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_introductions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "probation_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employment_period_id" TEXT,
    "start_date" DATE NOT NULL,
    "planned_end_date" DATE NOT NULL,
    "probation_months" INTEGER,
    "actual_end_date" DATE,
    "result" TEXT,
    "evaluation" TEXT,
    "confirmed_date" DATE,
    "extension_count" INTEGER NOT NULL DEFAULT 0,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "probation_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movement_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "movement_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_movements" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "movement_type_id" TEXT NOT NULL,
    "from_organization_id" TEXT,
    "to_organization_id" TEXT,
    "from_position_id" TEXT,
    "to_position_id" TEXT,
    "from_job_level" "JobLevelCode",
    "to_job_level" "JobLevelCode",
    "effective_date" DATE NOT NULL,
    "reason" TEXT,
    "approval_request_id" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trial_post_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "target_position_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "result" TEXT,
    "evaluator_user_id" TEXT,
    "comment" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trial_post_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "termination_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employment_period_id" TEXT,
    "application_date" DATE,
    "planned_last_working_date" DATE NOT NULL,
    "actual_last_working_date" DATE,
    "termination_type" TEXT NOT NULL,
    "reason" TEXT,
    "rehire_eligible" BOOLEAN,
    "handover_case_id" TEXT,
    "approval_request_id" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "termination_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retirement_records" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employment_period_id" TEXT,
    "planned_retirement_date" DATE NOT NULL,
    "actual_retirement_date" DATE,
    "retirement_type" TEXT NOT NULL,
    "pension_handling_status" TEXT,
    "remark" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retirement_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_agreements" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "employment_period_id" TEXT,
    "agreement_no" TEXT NOT NULL,
    "agreement_type" "AgreementType" NOT NULL,
    "employing_company_id" TEXT,
    "previous_agreement_id" TEXT,
    "signing_date" DATE,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "probation_end_date" DATE,
    "work_location" TEXT,
    "renewal_sequence" INTEGER NOT NULL DEFAULT 0,
    "termination_date" DATE,
    "termination_reason" TEXT,
    "attachment_id" TEXT,
    "status" "AgreementStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_template_versions" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "source_name" TEXT,
    "source_markdown" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "status" "PerformanceVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_cycles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "template_id" TEXT NOT NULL,
    "template_version_id" TEXT NOT NULL,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_cycles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_instances" (
    "id" TEXT NOT NULL,
    "cycle_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "source_markdown" TEXT NOT NULL,
    "definition_snapshot" JSONB NOT NULL,
    "organization_id" TEXT,
    "current_module_order" INTEGER,
    "fixed_weighted_score" DECIMAL(10,4),
    "adjustment_score" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "raw_final_score" DECIMAL(10,4),
    "final_score" DECIMAL(10,4),
    "employee_amount_base_id" TEXT,
    "employee_amount_base_snapshot" DECIMAL(12,2),
    "employee_amount_base_version_no" INTEGER,
    "calculation_formula" TEXT,
    "actual_amount" DECIMAL(12,2),
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_module_tasks" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "module_id" TEXT NOT NULL,
    "module_order" INTEGER NOT NULL,
    "module_name" TEXT NOT NULL,
    "module_type" "PerformanceModuleType" NOT NULL,
    "module_weight" DECIMAL(10,4),
    "module_snapshot" JSONB NOT NULL,
    "executor_type" "PerformanceExecutorType" NOT NULL,
    "executor_user_id" TEXT,
    "executor_directory_type" "PerformanceDirectoryType",
    "executor_directory_id" TEXT,
    "executor_name_snapshot" TEXT,
    "executor_account_snapshot" TEXT,
    "executor_resolved_at" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "raw_data" JSONB,
    "calculation_details" JSONB,
    "submission" JSONB,
    "module_score" DECIMAL(10,4),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_module_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_performance_amount_bases" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "version_no" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "effective_at" TIMESTAMP(3) NOT NULL,
    "replaced_at" TIMESTAMP(3),
    "changed_by_id" TEXT NOT NULL,
    "change_reason" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_performance_amount_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_result_revisions" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "previous_score" DECIMAL(10,4) NOT NULL,
    "next_score" DECIMAL(10,4) NOT NULL,
    "score_delta" DECIMAL(10,4) NOT NULL,
    "previous_amount" DECIMAL(12,2),
    "next_amount" DECIMAL(12,2),
    "reason" TEXT NOT NULL,
    "before_snapshot" JSONB NOT NULL,
    "after_snapshot" JSONB NOT NULL,
    "modified_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_result_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_field_change_logs" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "changed_field" TEXT NOT NULL,
    "old_value" JSONB,
    "new_value" JSONB,
    "changed_by_id" TEXT,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_field_change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "business_type" TEXT NOT NULL,
    "business_id" TEXT,
    "applicant_user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "submitted_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "approval_request_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "approver_user_id" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comment" TEXT,
    "operated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_change_requests" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "approval_request_id" TEXT,
    "changed_fields" JSONB NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB NOT NULL,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staffing_plans" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "position_id" TEXT,
    "plan_year" INTEGER NOT NULL,
    "approved_headcount" INTEGER NOT NULL,
    "frozen_headcount" INTEGER NOT NULL DEFAULT 0,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staffing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_cases" (
    "id" TEXT NOT NULL,
    "source_employee_id" TEXT NOT NULL,
    "target_employee_id" TEXT,
    "reason" TEXT,
    "planned_date" DATE,
    "completed_date" DATE,
    "owner_user_id" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'DRAFT',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handover_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handover_items" (
    "id" TEXT NOT NULL,
    "handover_case_id" TEXT NOT NULL,
    "item_type" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "description" TEXT,
    "attachment_id" TEXT,
    "confirmation_status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_at" TIMESTAMP(3),
    "remark" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handover_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dictionary_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dictionary_items" (
    "id" TEXT NOT NULL,
    "dictionary_type_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "extra_data" JSONB,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dictionary_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data_source" TEXT NOT NULL,
    "selected_fields" JSONB NOT NULL,
    "filters" JSONB,
    "grouping" JSONB,
    "sorting" JSONB,
    "creator_user_id" TEXT NOT NULL,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");

-- CreateIndex
CREATE INDEX "users_status_archived_at_idx" ON "users"("status", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_code_key" ON "organizations"("code");

-- CreateIndex
CREATE INDEX "organizations_parent_id_idx" ON "organizations"("parent_id");

-- CreateIndex
CREATE INDEX "organizations_archived_by_id_idx" ON "organizations"("archived_by_id");

-- CreateIndex
CREATE INDEX "organizations_status_archived_at_idx" ON "organizations"("status", "archived_at");

-- CreateIndex
CREATE INDEX "user_data_scopes_organization_id_idx" ON "user_data_scopes"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_data_scopes_user_id_organization_id_key" ON "user_data_scopes"("user_id", "organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_no_key" ON "employees"("employee_no");

-- CreateIndex
CREATE UNIQUE INDEX "employees_profile_photo_id_key" ON "employees"("profile_photo_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_id_card_no_key" ON "employees"("id_card_no");

-- CreateIndex
CREATE INDEX "employees_name_idx" ON "employees"("name");

-- CreateIndex
CREATE INDEX "employees_organization_id_idx" ON "employees"("organization_id");

-- CreateIndex
CREATE INDEX "employees_archived_by_id_idx" ON "employees"("archived_by_id");

-- CreateIndex
CREATE INDEX "employees_record_status_archived_at_idx" ON "employees"("record_status", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "employing_companies_code_key" ON "employing_companies"("code");

-- CreateIndex
CREATE INDEX "employing_companies_status_sort_order_idx" ON "employing_companies"("status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "positions_code_key" ON "positions"("code");

-- CreateIndex
CREATE INDEX "positions_organization_id_status_idx" ON "positions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "job_titles_code_key" ON "job_titles"("code");

-- CreateIndex
CREATE INDEX "job_titles_organization_id_status_idx" ON "job_titles"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "workplaces_code_key" ON "workplaces"("code");

-- CreateIndex
CREATE INDEX "workplaces_status_archived_at_idx" ON "workplaces"("status", "archived_at");

-- CreateIndex
CREATE INDEX "employment_periods_employee_id_employment_status_actual_exi_idx" ON "employment_periods"("employee_id", "employment_status", "actual_exit_date");

-- CreateIndex
CREATE INDEX "employment_periods_personnel_category_employment_status_idx" ON "employment_periods"("personnel_category", "employment_status");

-- CreateIndex
CREATE INDEX "employment_periods_personnel_source_employment_status_idx" ON "employment_periods"("personnel_source", "employment_status");

-- CreateIndex
CREATE INDEX "employment_periods_employment_relationship_employment_statu_idx" ON "employment_periods"("employment_relationship", "employment_status");

-- CreateIndex
CREATE UNIQUE INDEX "employment_periods_employee_id_sequence_no_key" ON "employment_periods"("employee_id", "sequence_no");

-- CreateIndex
CREATE INDEX "employee_assignments_employee_id_status_end_date_idx" ON "employee_assignments"("employee_id", "status", "end_date");

-- CreateIndex
CREATE INDEX "employee_assignments_organization_id_status_end_date_idx" ON "employee_assignments"("organization_id", "status", "end_date");

-- CreateIndex
CREATE INDEX "employee_assignments_personnel_category_status_idx" ON "employee_assignments"("personnel_category", "status");

-- CreateIndex
CREATE INDEX "employee_assignments_employment_relationship_status_idx" ON "employee_assignments"("employment_relationship", "status");

-- CreateIndex
CREATE INDEX "employee_assignments_employment_period_id_idx" ON "employee_assignments"("employment_period_id");

-- CreateIndex
CREATE INDEX "employee_assignments_job_level_status_idx" ON "employee_assignments"("job_level", "status");

-- CreateIndex
CREATE INDEX "employee_assignments_personnel_position_status_idx" ON "employee_assignments"("personnel_position", "status");

-- CreateIndex
CREATE INDEX "employee_assignments_employee_level_status_idx" ON "employee_assignments"("employee_level", "status");

-- CreateIndex
CREATE INDEX "employee_assignments_is_primary_status_idx" ON "employee_assignments"("is_primary", "status");

-- CreateIndex
CREATE INDEX "reporting_relationships_employee_id_status_end_date_idx" ON "reporting_relationships"("employee_id", "status", "end_date");

-- CreateIndex
CREATE INDEX "reporting_relationships_manager_employee_id_status_end_date_idx" ON "reporting_relationships"("manager_employee_id", "status", "end_date");

-- CreateIndex
CREATE INDEX "employee_identity_documents_employee_id_status_idx" ON "employee_identity_documents"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_identity_documents_expiry_date_status_idx" ON "employee_identity_documents"("expiry_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employee_identity_documents_document_type_document_number_key" ON "employee_identity_documents"("document_type", "document_number");

-- CreateIndex
CREATE INDEX "employment_records_employee_id_ended_at_idx" ON "employment_records"("employee_id", "ended_at");

-- CreateIndex
CREATE INDEX "employment_records_status_current_flag_idx" ON "employment_records"("status", "current_flag");

-- CreateIndex
CREATE INDEX "employment_records_employment_period_id_idx" ON "employment_records"("employment_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "employment_records_employee_id_current_flag_key" ON "employment_records"("employee_id", "current_flag");

-- CreateIndex
CREATE UNIQUE INDEX "file_attachments_storage_key_key" ON "file_attachments"("storage_key");

-- CreateIndex
CREATE INDEX "file_attachments_uploaded_by_id_status_idx" ON "file_attachments"("uploaded_by_id", "status");

-- CreateIndex
CREATE INDEX "employee_family_members_employee_id_status_idx" ON "employee_family_members"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_education_experiences_employee_id_status_end_date_idx" ON "employee_education_experiences"("employee_id", "status", "end_date");

-- CreateIndex
CREATE INDEX "employee_work_experiences_employee_id_status_start_date_idx" ON "employee_work_experiences"("employee_id", "status", "start_date");

-- CreateIndex
CREATE INDEX "employee_appraisals_employee_id_status_appraisal_date_idx" ON "employee_appraisals"("employee_id", "status", "appraisal_date");

-- CreateIndex
CREATE INDEX "employee_appraisals_evaluator_user_id_status_idx" ON "employee_appraisals"("evaluator_user_id", "status");

-- CreateIndex
CREATE INDEX "employee_training_records_employee_id_status_start_date_idx" ON "employee_training_records"("employee_id", "status", "start_date");

-- CreateIndex
CREATE INDEX "employee_awards_employee_id_status_award_date_idx" ON "employee_awards"("employee_id", "status", "award_date");

-- CreateIndex
CREATE INDEX "employee_certificates_employee_id_status_expiry_date_idx" ON "employee_certificates"("employee_id", "status", "expiry_date");

-- CreateIndex
CREATE INDEX "employee_certificates_certificate_no_idx" ON "employee_certificates"("certificate_no");

-- CreateIndex
CREATE INDEX "employee_project_experiences_employee_id_status_start_date_idx" ON "employee_project_experiences"("employee_id", "status", "start_date");

-- CreateIndex
CREATE INDEX "employee_skills_employee_id_status_idx" ON "employee_skills"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_language_abilities_employee_id_status_idx" ON "employee_language_abilities"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_documents_employee_id_document_type_status_idx" ON "employee_documents"("employee_id", "document_type", "status");

-- CreateIndex
CREATE INDEX "employee_blacklist_records_employee_id_status_idx" ON "employee_blacklist_records"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_blacklist_records_document_number_status_idx" ON "employee_blacklist_records"("document_number", "status");

-- CreateIndex
CREATE INDEX "employee_blacklist_records_created_by_id_status_idx" ON "employee_blacklist_records"("created_by_id", "status");

-- CreateIndex
CREATE INDEX "candidates_mobile_idx" ON "candidates"("mobile");

-- CreateIndex
CREATE INDEX "candidates_status_archived_at_idx" ON "candidates"("status", "archived_at");

-- CreateIndex
CREATE INDEX "candidate_identity_documents_candidate_id_status_idx" ON "candidate_identity_documents"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "candidate_identity_documents_expiry_date_status_idx" ON "candidate_identity_documents"("expiry_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "candidate_identity_documents_document_type_document_number_key" ON "candidate_identity_documents"("document_type", "document_number");

-- CreateIndex
CREATE INDEX "cand_edu_candidate_status_grad_idx" ON "candidate_education_experiences"("candidate_id", "status", "graduation_date");

-- CreateIndex
CREATE UNIQUE INDEX "offers_offer_no_key" ON "offers"("offer_no");

-- CreateIndex
CREATE INDEX "offers_candidate_id_status_idx" ON "offers"("candidate_id", "status");

-- CreateIndex
CREATE INDEX "offers_organization_id_proposed_entry_date_idx" ON "offers"("organization_id", "proposed_entry_date");

-- CreateIndex
CREATE INDEX "offers_direct_manager_employee_id_idx" ON "offers"("direct_manager_employee_id");

-- CreateIndex
CREATE INDEX "offers_employing_company_id_idx" ON "offers"("employing_company_id");

-- CreateIndex
CREATE UNIQUE INDEX "offer_compensation_snapshots_offer_id_key" ON "offer_compensation_snapshots"("offer_id");

-- CreateIndex
CREATE INDEX "offer_compensation_snapshots_status_archived_at_idx" ON "offer_compensation_snapshots"("status", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "offer_part_time_snapshots_offer_id_key" ON "offer_part_time_snapshots"("offer_id");

-- CreateIndex
CREATE INDEX "offer_part_time_snapshots_status_archived_at_idx" ON "offer_part_time_snapshots"("status", "archived_at");

-- CreateIndex
CREATE UNIQUE INDEX "onboarding_cases_offer_id_key" ON "onboarding_cases"("offer_id");

-- CreateIndex
CREATE INDEX "onboarding_cases_employee_id_status_idx" ON "onboarding_cases"("employee_id", "status");

-- CreateIndex
CREATE INDEX "onboarding_cases_planned_entry_date_status_idx" ON "onboarding_cases"("planned_entry_date", "status");

-- CreateIndex
CREATE INDEX "onboarding_cases_owner_user_id_status_idx" ON "onboarding_cases"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "onboarding_tasks_onboarding_case_id_status_idx" ON "onboarding_tasks"("onboarding_case_id", "status");

-- CreateIndex
CREATE INDEX "onboarding_tasks_responsible_user_id_due_date_status_idx" ON "onboarding_tasks"("responsible_user_id", "due_date", "status");

-- CreateIndex
CREATE INDEX "onboarding_integration_records_employee_id_status_idx" ON "onboarding_integration_records"("employee_id", "status");

-- CreateIndex
CREATE INDEX "employee_introductions_employee_id_status_idx" ON "employee_introductions"("employee_id", "status");

-- CreateIndex
CREATE INDEX "probation_records_employee_id_status_planned_end_date_idx" ON "probation_records"("employee_id", "status", "planned_end_date");

-- CreateIndex
CREATE UNIQUE INDEX "movement_types_code_key" ON "movement_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_movements_approval_request_id_key" ON "employee_movements"("approval_request_id");

-- CreateIndex
CREATE INDEX "employee_movements_employee_id_status_effective_date_idx" ON "employee_movements"("employee_id", "status", "effective_date");

-- CreateIndex
CREATE INDEX "employee_movements_movement_type_id_effective_date_idx" ON "employee_movements"("movement_type_id", "effective_date");

-- CreateIndex
CREATE INDEX "trial_post_records_employee_id_status_start_date_idx" ON "trial_post_records"("employee_id", "status", "start_date");

-- CreateIndex
CREATE INDEX "trial_post_records_evaluator_user_id_status_idx" ON "trial_post_records"("evaluator_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "termination_records_handover_case_id_key" ON "termination_records"("handover_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "termination_records_approval_request_id_key" ON "termination_records"("approval_request_id");

-- CreateIndex
CREATE INDEX "termination_records_employee_id_status_planned_last_working_idx" ON "termination_records"("employee_id", "status", "planned_last_working_date");

-- CreateIndex
CREATE INDEX "retirement_records_employee_id_status_planned_retirement_da_idx" ON "retirement_records"("employee_id", "status", "planned_retirement_date");

-- CreateIndex
CREATE UNIQUE INDEX "employee_agreements_agreement_no_key" ON "employee_agreements"("agreement_no");

-- CreateIndex
CREATE INDEX "employee_agreements_employee_id_status_end_date_idx" ON "employee_agreements"("employee_id", "status", "end_date");

-- CreateIndex
CREATE INDEX "employee_agreements_employing_company_id_status_idx" ON "employee_agreements"("employing_company_id", "status");

-- CreateIndex
CREATE INDEX "performance_templates_created_by_id_status_idx" ON "performance_templates"("created_by_id", "status");

-- CreateIndex
CREATE INDEX "performance_template_versions_template_id_status_idx" ON "performance_template_versions"("template_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_template_versions_template_id_version_no_key" ON "performance_template_versions"("template_id", "version_no");

-- CreateIndex
CREATE INDEX "performance_cycles_template_version_id_status_idx" ON "performance_cycles"("template_version_id", "status");

-- CreateIndex
CREATE INDEX "performance_cycles_period_start_period_end_status_idx" ON "performance_cycles"("period_start", "period_end", "status");

-- CreateIndex
CREATE INDEX "performance_instances_employee_id_status_idx" ON "performance_instances"("employee_id", "status");

-- CreateIndex
CREATE INDEX "performance_instances_organization_id_status_idx" ON "performance_instances"("organization_id", "status");

-- CreateIndex
CREATE INDEX "performance_instances_cycle_id_status_idx" ON "performance_instances"("cycle_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_instances_cycle_id_employee_id_key" ON "performance_instances"("cycle_id", "employee_id");

-- CreateIndex
CREATE INDEX "performance_module_tasks_executor_user_id_status_idx" ON "performance_module_tasks"("executor_user_id", "status");

-- CreateIndex
CREATE INDEX "performance_module_tasks_employee_id_status_idx" ON "performance_module_tasks"("employee_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "performance_module_tasks_instance_id_module_order_key" ON "performance_module_tasks"("instance_id", "module_order");

-- CreateIndex
CREATE UNIQUE INDEX "employee_performance_amount_bases_employee_id_version_no_key" ON "employee_performance_amount_bases"("employee_id", "version_no");

-- CreateIndex
CREATE INDEX "employee_performance_amount_bases_employee_id_effective_at_idx" ON "employee_performance_amount_bases"("employee_id", "effective_at");

-- CreateIndex
CREATE INDEX "employee_performance_amount_bases_changed_by_id_created_at_idx" ON "employee_performance_amount_bases"("changed_by_id", "created_at");

-- CreateIndex
CREATE INDEX "performance_result_revisions_modified_by_id_created_at_idx" ON "performance_result_revisions"("modified_by_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "performance_result_revisions_instance_id_revision_no_key" ON "performance_result_revisions"("instance_id", "revision_no");

-- CreateIndex
CREATE INDEX "employee_field_change_logs_employee_id_changed_at_idx" ON "employee_field_change_logs"("employee_id", "changed_at");

-- CreateIndex
CREATE INDEX "employee_field_change_logs_assignment_id_changed_at_idx" ON "employee_field_change_logs"("assignment_id", "changed_at");

-- CreateIndex
CREATE INDEX "employee_field_change_logs_changed_by_id_changed_at_idx" ON "employee_field_change_logs"("changed_by_id", "changed_at");

-- CreateIndex
CREATE INDEX "approval_requests_business_type_business_id_idx" ON "approval_requests"("business_type", "business_id");

-- CreateIndex
CREATE INDEX "approval_requests_applicant_user_id_status_idx" ON "approval_requests"("applicant_user_id", "status");

-- CreateIndex
CREATE INDEX "approval_requests_status_submitted_at_idx" ON "approval_requests"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "approval_steps_approver_user_id_decision_idx" ON "approval_steps"("approver_user_id", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "approval_steps_approval_request_id_step_order_key" ON "approval_steps"("approval_request_id", "step_order");

-- CreateIndex
CREATE UNIQUE INDEX "employee_change_requests_approval_request_id_key" ON "employee_change_requests"("approval_request_id");

-- CreateIndex
CREATE INDEX "employee_change_requests_employee_id_status_idx" ON "employee_change_requests"("employee_id", "status");

-- CreateIndex
CREATE INDEX "staffing_plans_plan_year_status_idx" ON "staffing_plans"("plan_year", "status");

-- CreateIndex
CREATE UNIQUE INDEX "staffing_plans_organization_id_position_id_plan_year_key" ON "staffing_plans"("organization_id", "position_id", "plan_year");

-- CreateIndex
CREATE INDEX "handover_cases_source_employee_id_status_idx" ON "handover_cases"("source_employee_id", "status");

-- CreateIndex
CREATE INDEX "handover_cases_target_employee_id_status_idx" ON "handover_cases"("target_employee_id", "status");

-- CreateIndex
CREATE INDEX "handover_cases_owner_user_id_status_idx" ON "handover_cases"("owner_user_id", "status");

-- CreateIndex
CREATE INDEX "handover_items_handover_case_id_confirmation_status_idx" ON "handover_items"("handover_case_id", "confirmation_status");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_types_code_key" ON "dictionary_types"("code");

-- CreateIndex
CREATE INDEX "dictionary_items_dictionary_type_id_status_sort_order_idx" ON "dictionary_items"("dictionary_type_id", "status", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "dictionary_items_dictionary_type_id_code_key" ON "dictionary_items"("dictionary_type_id", "code");

-- CreateIndex
CREATE INDEX "report_definitions_creator_user_id_status_idx" ON "report_definitions"("creator_user_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data_scopes" ADD CONSTRAINT "user_data_scopes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_data_scopes" ADD CONSTRAINT "user_data_scopes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_archived_by_id_fkey" FOREIGN KEY ("archived_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_profile_photo_id_fkey" FOREIGN KEY ("profile_photo_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_titles" ADD CONSTRAINT "job_titles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_periods" ADD CONSTRAINT "employment_periods_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_periods" ADD CONSTRAINT "employment_periods_previous_period_id_fkey" FOREIGN KEY ("previous_period_id") REFERENCES "employment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_employment_period_id_fkey" FOREIGN KEY ("employment_period_id") REFERENCES "employment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_job_title_id_fkey" FOREIGN KEY ("job_title_id") REFERENCES "job_titles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_assignments" ADD CONSTRAINT "employee_assignments_workplace_id_fkey" FOREIGN KEY ("workplace_id") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_relationships" ADD CONSTRAINT "reporting_relationships_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_relationships" ADD CONSTRAINT "reporting_relationships_manager_employee_id_fkey" FOREIGN KEY ("manager_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_identity_documents" ADD CONSTRAINT "employee_identity_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_identity_documents" ADD CONSTRAINT "employee_identity_documents_front_attachment_id_fkey" FOREIGN KEY ("front_attachment_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_identity_documents" ADD CONSTRAINT "employee_identity_documents_back_attachment_id_fkey" FOREIGN KEY ("back_attachment_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employment_records" ADD CONSTRAINT "employment_records_employment_period_id_fkey" FOREIGN KEY ("employment_period_id") REFERENCES "employment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "file_attachments" ADD CONSTRAINT "file_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_family_members" ADD CONSTRAINT "employee_family_members_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_education_experiences" ADD CONSTRAINT "employee_education_experiences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_work_experiences" ADD CONSTRAINT "employee_work_experiences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_appraisals" ADD CONSTRAINT "employee_appraisals_evaluator_user_id_fkey" FOREIGN KEY ("evaluator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_appraisals" ADD CONSTRAINT "employee_appraisals_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_training_records" ADD CONSTRAINT "employee_training_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_awards" ADD CONSTRAINT "employee_awards_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certificates" ADD CONSTRAINT "employee_certificates_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_certificates" ADD CONSTRAINT "employee_certificates_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_project_experiences" ADD CONSTRAINT "employee_project_experiences_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_skills" ADD CONSTRAINT "employee_skills_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_language_abilities" ADD CONSTRAINT "employee_language_abilities_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "file_attachments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_blacklist_records" ADD CONSTRAINT "employee_blacklist_records_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_blacklist_records" ADD CONSTRAINT "employee_blacklist_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_converted_employee_id_fkey" FOREIGN KEY ("converted_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_identity_documents" ADD CONSTRAINT "candidate_identity_documents_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "candidate_education_experiences" ADD CONSTRAINT "candidate_education_experiences_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_accepted_employee_id_fkey" FOREIGN KEY ("accepted_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_direct_manager_employee_id_fkey" FOREIGN KEY ("direct_manager_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_workplace_id_fkey" FOREIGN KEY ("workplace_id") REFERENCES "workplaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_employing_company_id_fkey" FOREIGN KEY ("employing_company_id") REFERENCES "employing_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_compensation_snapshots" ADD CONSTRAINT "offer_compensation_snapshots_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_part_time_snapshots" ADD CONSTRAINT "offer_part_time_snapshots_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_cases" ADD CONSTRAINT "onboarding_cases_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_cases" ADD CONSTRAINT "onboarding_cases_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_cases" ADD CONSTRAINT "onboarding_cases_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_onboarding_case_id_fkey" FOREIGN KEY ("onboarding_case_id") REFERENCES "onboarding_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_tasks" ADD CONSTRAINT "onboarding_tasks_responsible_user_id_fkey" FOREIGN KEY ("responsible_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_integration_records" ADD CONSTRAINT "onboarding_integration_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_introductions" ADD CONSTRAINT "employee_introductions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probation_records" ADD CONSTRAINT "probation_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "probation_records" ADD CONSTRAINT "probation_records_employment_period_id_fkey" FOREIGN KEY ("employment_period_id") REFERENCES "employment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_movement_type_id_fkey" FOREIGN KEY ("movement_type_id") REFERENCES "movement_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_from_organization_id_fkey" FOREIGN KEY ("from_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_to_organization_id_fkey" FOREIGN KEY ("to_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_from_position_id_fkey" FOREIGN KEY ("from_position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_to_position_id_fkey" FOREIGN KEY ("to_position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_movements" ADD CONSTRAINT "employee_movements_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_post_records" ADD CONSTRAINT "trial_post_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_post_records" ADD CONSTRAINT "trial_post_records_target_position_id_fkey" FOREIGN KEY ("target_position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trial_post_records" ADD CONSTRAINT "trial_post_records_evaluator_user_id_fkey" FOREIGN KEY ("evaluator_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termination_records" ADD CONSTRAINT "termination_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termination_records" ADD CONSTRAINT "termination_records_employment_period_id_fkey" FOREIGN KEY ("employment_period_id") REFERENCES "employment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termination_records" ADD CONSTRAINT "termination_records_handover_case_id_fkey" FOREIGN KEY ("handover_case_id") REFERENCES "handover_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "termination_records" ADD CONSTRAINT "termination_records_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retirement_records" ADD CONSTRAINT "retirement_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retirement_records" ADD CONSTRAINT "retirement_records_employment_period_id_fkey" FOREIGN KEY ("employment_period_id") REFERENCES "employment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_employment_period_id_fkey" FOREIGN KEY ("employment_period_id") REFERENCES "employment_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_employing_company_id_fkey" FOREIGN KEY ("employing_company_id") REFERENCES "employing_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_previous_agreement_id_fkey" FOREIGN KEY ("previous_agreement_id") REFERENCES "employee_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_agreements" ADD CONSTRAINT "employee_agreements_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_templates" ADD CONSTRAINT "performance_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_template_versions" ADD CONSTRAINT "performance_template_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "performance_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_template_versions" ADD CONSTRAINT "performance_template_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "performance_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "performance_template_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_cycles" ADD CONSTRAINT "performance_cycles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_instances" ADD CONSTRAINT "performance_instances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_instances" ADD CONSTRAINT "performance_instances_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_instances" ADD CONSTRAINT "performance_instances_cycle_id_fkey" FOREIGN KEY ("cycle_id") REFERENCES "performance_cycles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_instances" ADD CONSTRAINT "performance_instances_employee_amount_base_id_fkey" FOREIGN KEY ("employee_amount_base_id") REFERENCES "employee_performance_amount_bases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_module_tasks" ADD CONSTRAINT "performance_module_tasks_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "performance_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_module_tasks" ADD CONSTRAINT "performance_module_tasks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_module_tasks" ADD CONSTRAINT "performance_module_tasks_executor_user_id_fkey" FOREIGN KEY ("executor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_performance_amount_bases" ADD CONSTRAINT "employee_performance_amount_bases_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_performance_amount_bases" ADD CONSTRAINT "employee_performance_amount_bases_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_result_revisions" ADD CONSTRAINT "performance_result_revisions_modified_by_id_fkey" FOREIGN KEY ("modified_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_result_revisions" ADD CONSTRAINT "performance_result_revisions_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "performance_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_field_change_logs" ADD CONSTRAINT "employee_field_change_logs_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_field_change_logs" ADD CONSTRAINT "employee_field_change_logs_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "employee_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_field_change_logs" ADD CONSTRAINT "employee_field_change_logs_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_change_requests" ADD CONSTRAINT "employee_change_requests_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_change_requests" ADD CONSTRAINT "employee_change_requests_approval_request_id_fkey" FOREIGN KEY ("approval_request_id") REFERENCES "approval_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_plans" ADD CONSTRAINT "staffing_plans_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staffing_plans" ADD CONSTRAINT "staffing_plans_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_cases" ADD CONSTRAINT "handover_cases_source_employee_id_fkey" FOREIGN KEY ("source_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_cases" ADD CONSTRAINT "handover_cases_target_employee_id_fkey" FOREIGN KEY ("target_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_cases" ADD CONSTRAINT "handover_cases_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_handover_case_id_fkey" FOREIGN KEY ("handover_case_id") REFERENCES "handover_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handover_items" ADD CONSTRAINT "handover_items_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "file_attachments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dictionary_items" ADD CONSTRAINT "dictionary_items_dictionary_type_id_fkey" FOREIGN KEY ("dictionary_type_id") REFERENCES "dictionary_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_definitions" ADD CONSTRAINT "report_definitions_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

