import { Injectable } from '@nestjs/common';
import { AssignmentStatus, EmploymentStatus, Prisma, RecordStatus } from '@prisma/client';
import type {
  AppraisalListItem,
  AwardListItem,
  CertificateListItem,
  EducationListItem,
  FamilyListItem,
  LanguageListItem,
  Paginated,
  ProjectListItem,
  SkillListItem,
  TrainingListItem,
  WorkHistoryListItem,
} from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueryEmployeeSubsetDto } from './dto/query-employee-subset.dto';

@Injectable()
export class EmployeeSubsetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
    private readonly demo: DemoDataService,
  ) {}

  async findEducation(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<EducationListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeEducationExperienceWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeEducationExperienceWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeEducationExperience.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          startDate: true,
          endDate: true,
          schoolName: true,
          major: true,
          educationLevel: true,
          degree: true,
          isHighestEducation: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [
          { graduationDate: 'desc' },
          { createdAt: 'desc' },
          { id: 'asc' },
        ],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeEducationExperience.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        startDate: this.formatDate(row.startDate),
        endDate: this.formatDate(row.endDate),
        schoolName: row.schoolName ?? null,
        schoolType: null,
        major: row.major,
        educationLevel: row.educationLevel ?? null,
        degree: row.degree,
        isHighestEducation: row.isHighestEducation,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findWorkHistory(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<WorkHistoryListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeWorkExperienceWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeWorkExperienceWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeWorkExperience.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          companyName: true,
          startDate: true,
          endDate: true,
          referenceName: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: {
                  organization: { select: { name: true } },
                  jobTitle: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeWorkExperience.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        companyName: row.companyName ?? null,
        jobTitleName: row.employee.assignments[0]?.jobTitle?.name ?? null,
        startDate: this.formatDate(row.startDate),
        endDate: this.formatDate(row.endDate),
        referenceName: row.referenceName,
        approvalStatus: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findFamily(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<FamilyListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeFamilyMemberWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeFamilyMemberWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeFamilyMember.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          name: true,
          relationship: true,
          gender: true,
          mobile: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeFamilyMember.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        memberName: row.name ?? null,
        relationshipName: row.relationship,
        gender: row.gender,
        mobile: row.mobile,
        approvalStatus: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findAppraisals(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<AppraisalListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeAppraisalWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeAppraisalWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeAppraisal.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          appraisalPeriod: true,
          appraisalType: true,
          score: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ appraisalDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeAppraisal.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        appraisalYear: this.extractAppraisalYear(row.appraisalPeriod),
        periodName: row.appraisalPeriod ?? null,
        performanceActivity: row.appraisalType ?? null,
        appraisalDepartment: null,
        finalScore: this.decimalToNumber(row.score),
        startDate: null,
        endDate: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findTraining(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<TrainingListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeTrainingRecordWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeTrainingRecordWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeTrainingRecord.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          startDate: true,
          endDate: true,
          trainingName: true,
          trainingProvider: true,
          result: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeTrainingRecord.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        startDate: this.formatDate(row.startDate),
        endDate: this.formatDate(row.endDate),
        trainingName: row.trainingName ?? null,
        trainingProvider: row.trainingProvider,
        trainingResult: row.result,
        approvalStatus: null,
        credits: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findAwards(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<AwardListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeAwardWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeAwardWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeAward.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          awardDate: true,
          awardName: true,
          reason: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ awardDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeAward.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        awardDate: this.formatDate(row.awardDate),
        awardName: row.awardName ?? null,
        summary: row.reason,
        approvalStatus: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findCertificates(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<CertificateListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeCertificateWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeCertificateWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeCertificate.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          certificateName: true,
          certificateNo: true,
          issuingAuthority: true,
          issueDate: true,
          expiryDate: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ issueDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeCertificate.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        certificateName: row.certificateName ?? null,
        certificateNo: row.certificateNo,
        issuingAuthority: row.issuingAuthority,
        issueDate: this.formatDate(row.issueDate),
        expiryDate: this.formatDate(row.expiryDate),
        approvalStatus: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findProjects(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<ProjectListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeProjectExperienceWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeProjectExperienceWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeProjectExperience.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          startDate: true,
          endDate: true,
          projectName: true,
          projectRole: true,
          projectDescription: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeProjectExperience.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        startDate: this.formatDate(row.startDate),
        endDate: this.formatDate(row.endDate),
        projectName: row.projectName ?? null,
        projectRole: row.projectRole,
        description: row.projectDescription,
        approvalStatus: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findSkills(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<SkillListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeSkillWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeSkillWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeSkill.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          skillName: true,
          proficiencyLevel: true,
          skillCategory: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeSkill.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        skillName: row.skillName ?? null,
        proficiencyLevel: row.proficiencyLevel,
        skillCategory: row.skillCategory,
        approvalStatus: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  async findLanguages(
    user: AuthenticatedUser,
    query: QueryEmployeeSubsetDto,
  ): Promise<Paginated<LanguageListItem>> {
    if (this.demo.enabled) return this.emptyPage(query);

    const scope = await this.resolveSubsetScope(user, query);
    if (scope.empty) return this.emptyPage(query);
    const now = new Date();
    const conditions: Prisma.EmployeeLanguageAbilityWhereInput[] = [
      { status: RecordStatus.ACTIVE },
      { archivedAt: null },
      { employee: { is: { recordStatus: RecordStatus.ACTIVE, archivedAt: null } } },
    ];
    if (!scope.hasAllEmployeeData || query.organizationId) {
      conditions.push({
        employee: {
          is: {
            assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
          },
        },
      });
    }
    this.addEmployeeKeywordCondition(conditions, query.keyword);
    const where: Prisma.EmployeeLanguageAbilityWhereInput = { AND: conditions };
    const assignmentWhere = this.currentAssignmentWhere(scope.organizationIds, now);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.employeeLanguageAbility.findMany({
        where,
        select: {
          id: true,
          employeeId: true,
          language: true,
          writingLevel: true,
          readingLevel: true,
          speakingLevel: true,
          employee: {
            select: {
              name: true,
              employeeNo: true,
              workEmail: true,
              assignments: {
                where: { ...assignmentWhere, isPrimary: true },
                orderBy: [{ startDate: 'desc' }, { id: 'asc' }],
                take: 1,
                select: { organization: { select: { name: true } } },
              },
            },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employeeLanguageAbility.count({ where }),
    ]);
    const detailEmployeeIds = await this.getDetailEmployeeIds(user, rows.map((row) => row.employeeId), scope, now);
    return {
      data: rows.map((row) => ({
        id: row.id,
        employeeId: row.employeeId,
        employeeName: row.employee.name ?? '--',
        employeeNo: row.employee.employeeNo,
        workEmail: row.employee.workEmail,
        departmentName: row.employee.assignments[0]?.organization.name ?? null,
        language: row.language ?? null,
        nativeLanguage: null,
        proficiencyLevel: null,
        writingLevel: row.writingLevel,
        readingLevel: row.readingLevel,
        speakingLevel: row.speakingLevel,
        approvalStatus: null,
        canViewEmployeeDetail: detailEmployeeIds.has(row.employeeId),
      })),
      meta: this.pageMeta(query, total),
    };
  }

  private async resolveSubsetScope(user: AuthenticatedUser, query: QueryEmployeeSubsetDto): Promise<{
    hasAllEmployeeData: boolean;
    organizationIds?: string[];
    empty: boolean;
  }> {
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? undefined
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];
    if (query.organizationId) {
      const organizationIds = await this.access.getOrganizationSubtreeIds(
        query.organizationId,
        hasAllEmployeeData ? undefined : accessibleOrganizationIds,
      );
      return { hasAllEmployeeData, organizationIds, empty: organizationIds.length === 0 };
    }
    if (!hasAllEmployeeData && accessibleOrganizationIds?.length === 0) {
      return { hasAllEmployeeData, organizationIds: [], empty: true };
    }
    return { hasAllEmployeeData, organizationIds: accessibleOrganizationIds, empty: false };
  }

  private currentAssignmentWhere(
    organizationIds: string[] | undefined,
    now = new Date(),
  ): Prisma.EmployeeAssignmentWhereInput {
    const today = new Date(Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ));
    return {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: today },
      OR: [{ endDate: null }, { endDate: { gte: today } }],
      employmentPeriod: {
        is: {
          status: RecordStatus.ACTIVE,
          archivedAt: null,
          employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] },
          actualExitDate: null,
        },
      },
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
    };
  }

  private addEmployeeKeywordCondition<T extends { employee?: unknown }>(
    conditions: T[],
    keyword?: string,
  ) {
    if (!keyword) return;
    conditions.push({
      employee: {
        is: {
          OR: [
            { employeeNo: { contains: keyword } },
            { name: { contains: keyword } },
          ],
        },
      },
    } as T);
  }

  private async getDetailEmployeeIds(
    user: AuthenticatedUser,
    employeeIds: string[],
    scope: { hasAllEmployeeData: boolean; organizationIds?: string[] },
    now: Date,
  ) {
    const ids = [...new Set(employeeIds)];
    if (ids.length === 0) return new Set<string>();
    if (scope.hasAllEmployeeData) return new Set(ids);
    const detailRows = await this.prisma.employee.findMany({
      where: {
        id: { in: ids },
        recordStatus: RecordStatus.ACTIVE,
        archivedAt: null,
        assignments: { some: this.currentAssignmentWhere(scope.organizationIds, now) },
      },
      select: { id: true },
    });
    return new Set(detailRows.map(({ id }) => id));
  }

  private formatDate(value: Date | null) {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  private extractAppraisalYear(period: string | null) {
    const match = period?.match(/(?:^|\D)(\d{4})(?!\d)/);
    return match ? Number(match[1]) : null;
  }

  private decimalToNumber(value: Prisma.Decimal | null | undefined) {
    if (value === null || value === undefined) return null;
    return typeof value.toNumber === 'function' ? value.toNumber() : Number(value);
  }

  private pageMeta(query: QueryEmployeeSubsetDto, total: number) {
    return {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  private assertDemoOrReturnEmpty<T>(query: QueryEmployeeSubsetDto): Paginated<T> {
    if (this.demo.enabled) return this.emptyPage(query);

    // Database mappings are added per subset in a later stage. Keeping this gate
    // explicit prevents either runtime mode from returning inferred records.
    return this.emptyPage(query);
  }

  private emptyPage<T>(query: QueryEmployeeSubsetDto): Paginated<T> {
    return {
      data: [],
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: 0,
        totalPages: 0,
      },
    };
  }
}
