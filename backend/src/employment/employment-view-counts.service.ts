import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import {
  AssignmentStatus,
  EmploymentRelationship,
  EmploymentStatus,
  Prisma,
  ProcessStatus,
  RecordStatus,
  WorkArrangement,
} from '@prisma/client';
import { PERMISSIONS } from '@hr-demo/shared';
import { AccessControlService } from '../access-control/access-control.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  isStrictBusinessDate,
  QueryEmploymentViewCountsDto,
} from './dto/query-employment-view-counts.dto';

export const EMPLOYMENT_VIEW_COUNT_KEYS = [
  'probation.expiring',
  'probation.reviewing',
  'probation.approval',
  'probation.all',
  'probation.completed',
  'records.current',
  'records.history',
  'interns.intern',
  'interns.conversion_pending',
  'interns.converted',
  'interns.resigned',
  'labor.on_duty',
  'labor.conversion_pending',
  'labor.converted',
  'labor.resigned',
  'movements.active',
  'movements.completed',
  'movements.all',
  'trial-posts.in_progress',
  'trial-posts.reviewing',
  'trial-posts.failed',
  'trial-posts.passed',
  'trial-posts.all',
  'terminations.in_progress',
  'terminations.completed',
  'terminations.all',
  'retirements.upcoming',
  'retirements.in_progress',
  'retirements.overdue',
  'retirements.completed',
  'retirements.all',
  'retirements.intention_pending',
  'part-time.active',
  'part-time.expiring',
  'part-time.not_started',
  'part-time.ended',
  'part-time.all',
  'part-time.approval',
] as const;

export type EmploymentViewCountKey = typeof EMPLOYMENT_VIEW_COUNT_KEYS[number];
export type EmploymentViewCountOrganizationMode = 'ALL_DATA' | 'AUTHORIZED_SUBTREE';

export interface EmploymentViewCountItem {
  key: EmploymentViewCountKey;
  label: string;
  supported: boolean;
  count: number | null;
  reason: string | null;
}

export interface EmploymentViewCountsResponse {
  businessDate: string;
  scope: {
    organizationId: string | null;
    organizationMode: EmploymentViewCountOrganizationMode;
  };
  items: EmploymentViewCountItem[];
}

type CountPromise = PromiseLike<number>;

const LABELS: Record<EmploymentViewCountKey, string> = {
  'probation.expiring': '试用即将到期',
  'probation.reviewing': '试用考核中',
  'probation.approval': '转正审批中',
  'probation.all': '全部试用',
  'probation.completed': '已完成转正',
  'records.current': '当前有效任职',
  'records.history': '完整历史',
  'interns.intern': '实习中',
  'interns.conversion_pending': '实习转正中',
  'interns.converted': '实习已转正',
  'interns.resigned': '实习已离职',
  'labor.on_duty': '在岗劳务人员',
  'labor.conversion_pending': '劳务转正式中',
  'labor.converted': '劳务已转正式',
  'labor.resigned': '劳务已离职',
  'movements.active': '异动中',
  'movements.completed': '已完成异动',
  'movements.all': '全部异动',
  'trial-posts.in_progress': '试岗中',
  'trial-posts.reviewing': '试岗考核中',
  'trial-posts.failed': '试岗不通过',
  'trial-posts.passed': '试岗通过',
  'trial-posts.all': '全部试岗',
  'terminations.in_progress': '离职办理中',
  'terminations.completed': '已完成离职',
  'terminations.all': '全部离职',
  'retirements.upcoming': '即将退休',
  'retirements.in_progress': '退休办理中',
  'retirements.overdue': '过期未退休',
  'retirements.completed': '已完成退休',
  'retirements.all': '全部退休',
  'retirements.intention_pending': '退休意向申请中',
  'part-time.active': '兼职中',
  'part-time.expiring': '兼职即将到期',
  'part-time.not_started': '兼职未开始',
  'part-time.ended': '兼职已结束',
  'part-time.all': '全部兼职',
  'part-time.approval': '兼职审批中',
};

const UNSUPPORTED_REASONS: Partial<Record<EmploymentViewCountKey, string>> = {
  'records.history': '统一历史计数口径待 P0 实现',
  'interns.conversion_pending': '尚未确认实习转换事件来源',
  'interns.converted': '尚未确认实习转换事件来源',
  'interns.resigned': '尚未确认实习离职历史来源',
  'labor.conversion_pending': '尚未确认劳务转换事件来源',
  'labor.converted': '尚未确认劳务转换事件来源',
  'labor.resigned': '尚未确认劳务离职历史来源',
  'movements.active': '异动历史组织授权计数来源待 P0 实现',
  'movements.completed': '异动历史组织授权计数来源待 P0 实现',
  'movements.all': '异动历史组织授权计数来源待 P0 实现',
  'trial-posts.in_progress': '试岗视图状态口径待 P0 实现',
  'trial-posts.reviewing': '试岗考核结果来源尚未确认',
  'trial-posts.failed': '试岗考核结果来源尚未确认',
  'trial-posts.passed': '试岗考核结果来源尚未确认',
  'trial-posts.all': '试岗视图状态口径待 P0 实现',
  'terminations.in_progress': '离职历史组织授权计数来源待 P0 实现',
  'terminations.completed': '离职历史组织授权计数来源待 P0 实现',
  'terminations.all': '离职历史组织授权计数来源待 P0 实现',
  'retirements.upcoming': '退休历史组织授权计数来源待 P0 实现',
  'retirements.in_progress': '退休历史组织授权计数来源待 P0 实现',
  'retirements.overdue': '退休历史组织授权计数来源待 P0 实现',
  'retirements.completed': '退休历史组织授权计数来源待 P0 实现',
  'retirements.all': '退休历史组织授权计数来源待 P0 实现',
  'retirements.intention_pending': '退休意向申请来源尚未接入',
  'part-time.expiring': '兼职到期预警窗口尚未确认',
  'part-time.ended': '兼职历史组织授权计数来源待 P0 实现',
  'part-time.all': '兼职完整历史计数口径待 P0 实现',
  'part-time.approval': '尚未确认兼职申请与审批来源',
};

interface CountContext {
  businessDay: Date;
  organizationIds: string[] | undefined;
  probationVisibleIds: string[] | undefined;
}

@Injectable()
export class EmploymentViewCountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessControlService,
  ) {}

  async getViewCounts(
    user: AuthenticatedUser,
    query: QueryEmploymentViewCountsDto,
  ): Promise<EmploymentViewCountsResponse> {
    if (!this.access.hasPermission(user, PERMISSIONS.EMPLOYEE_READ)) {
      throw new ForbiddenException('没有执行此操作的权限');
    }

    const businessDate = this.resolveBusinessDate(query.businessDate);
    const organizationId = this.normalizeOrganizationId(query.organizationId);
    const hasAllEmployeeData = this.access.hasAllEmployeeData(user);
    const accessibleOrganizationIds = hasAllEmployeeData
      ? undefined
      : (await this.access.getAccessibleOrganizationIds(user)) ?? [];

    let organizationIds = accessibleOrganizationIds;
    if (organizationId) {
      const subtreeIds = await this.access.getOrganizationSubtreeIds(
        organizationId,
        hasAllEmployeeData ? undefined : accessibleOrganizationIds,
      );
      if (subtreeIds.length === 0) {
        throw new ForbiddenException('所选组织不在当前账号的数据范围内');
      }
      organizationIds = subtreeIds;
    }

    const probationVisibleIds = organizationIds === undefined
      ? undefined
      : organizationIds.length === 0
        ? []
        : await this.findProbationVisibleIds(organizationIds);
    const context: CountContext = {
      businessDay: businessDate,
      organizationIds,
      probationVisibleIds,
    };
    const supported = this.buildSupportedCounts(context);
    const supportedKeys = new Set<EmploymentViewCountKey>(supported.map(({ key }) => key));

    const values = await Promise.all(supported.map(({ query: countQuery }) => countQuery));
    const counts = new Map<EmploymentViewCountKey, number>();
    supported.forEach(({ key }, index) => {
      const value = values[index];
      counts.set(key, Number.isInteger(value) && value >= 0 ? value : 0);
    });

    return {
      businessDate: this.formatBusinessDate(businessDate),
      scope: {
        organizationId: organizationId ?? null,
        organizationMode: hasAllEmployeeData ? 'ALL_DATA' : 'AUTHORIZED_SUBTREE',
      },
      items: EMPLOYMENT_VIEW_COUNT_KEYS.map((key) => {
        if (supportedKeys.has(key)) {
          return {
            key,
            label: LABELS[key],
            supported: true,
            count: counts.get(key) ?? 0,
            reason: null,
          };
        }
        return {
          key,
          label: LABELS[key],
          supported: false,
          count: null,
          reason: UNSUPPORTED_REASONS[key] ?? '独立可靠的计数来源尚未接入',
        };
      }),
    };
  }

  private buildSupportedCounts(context: CountContext): Array<{ key: EmploymentViewCountKey; query: CountPromise }> {
    const { businessDay, organizationIds, probationVisibleIds } = context;
    const activeEmployee = {
      is: {
        archivedAt: null,
        recordStatus: RecordStatus.ACTIVE,
      },
    };
    const currentAssignment = this.currentAssignmentWhere(businessDay, organizationIds);

    const probationBase: Prisma.ProbationRecordWhereInput[] = [
      { archivedAt: null },
      { employee: activeEmployee },
    ];
    if (probationVisibleIds) {
      probationBase.push({ id: { in: probationVisibleIds } });
    }

    const probationCount = (extra: Prisma.ProbationRecordWhereInput) => this.prisma.probationRecord.count({
      where: { AND: [...probationBase, extra] },
    });
    const currentEmploymentCount = this.prisma.employeeAssignment.count({
      where: { AND: [currentAssignment] },
    });
    const internCount = this.prisma.employmentPeriod.count({
      where: {
        AND: [
          { employmentRelationship: EmploymentRelationship.INTERN },
          { employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] } },
          { actualExitDate: null },
          { entryDate: { lte: businessDay } },
          { status: RecordStatus.ACTIVE },
          { archivedAt: null },
          { employee: activeEmployee },
          ...(organizationIds ? [{ assignments: { some: currentAssignment } }] : []),
        ],
      },
    });
    const laborCount = this.prisma.employmentPeriod.count({
      where: {
        AND: [
          { employmentRelationship: EmploymentRelationship.LABOR_WORKER },
          { employmentStatus: { in: [EmploymentStatus.PROBATION, EmploymentStatus.REGULAR, EmploymentStatus.NON_REGULAR] } },
          { actualExitDate: null },
          { entryDate: { lte: businessDay } },
          { status: RecordStatus.ACTIVE },
          { archivedAt: null },
          { employee: activeEmployee },
          ...(organizationIds ? [{ assignments: { some: currentAssignment } }] : []),
        ],
      },
    });
    const partTimeCount = this.prisma.employeeAssignment.count({
      where: {
        AND: [
          currentAssignment,
          { workArrangement: WorkArrangement.PART_TIME },
        ],
      },
    });

    const inThirtyDays = new Date(businessDay);
    inThirtyDays.setUTCDate(inThirtyDays.getUTCDate() + 30);

    return [
      {
        key: 'probation.expiring',
        query: probationCount({
          status: ProcessStatus.DRAFT,
          plannedEndDate: { gte: businessDay, lte: inThirtyDays },
        }),
      },
      {
        key: 'probation.reviewing',
        query: probationCount({ status: ProcessStatus.IN_PROGRESS }),
      },
      {
        key: 'probation.approval',
        query: probationCount({ status: ProcessStatus.PENDING }),
      },
      {
        key: 'probation.all',
        query: probationCount({ status: { notIn: [ProcessStatus.COMPLETED, ProcessStatus.CANCELLED] } }),
      },
      {
        key: 'probation.completed',
        query: probationCount({ status: ProcessStatus.COMPLETED }),
      },
      {
        key: 'records.current',
        query: currentEmploymentCount,
      },
      {
        key: 'interns.intern',
        query: internCount,
      },
      {
        key: 'labor.on_duty',
        query: laborCount,
      },
      {
        key: 'part-time.active',
        query: partTimeCount,
      },
      {
        key: 'part-time.not_started',
        query: this.prisma.employeeAssignment.count({
          where: {
            AND: [
              {
                workArrangement: WorkArrangement.PART_TIME,
              },
              {
                status: AssignmentStatus.ACTIVE,
              },
              { archivedAt: null },
              { startDate: { gt: businessDay } },
              { employee: activeEmployee },
              ...(organizationIds ? [{ organizationId: { in: organizationIds } }] : []),
            ],
          },
        }),
      },
    ];
  }

  private async findProbationVisibleIds(organizationIds: string[]): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT probation.id
      FROM probation_records AS probation
      WHERE probation.employment_period_id IS NOT NULL
        AND probation.archived_at IS NULL
        AND EXISTS (
          SELECT 1
          FROM employee_assignments AS assignment
          WHERE assignment.employee_id = probation.employee_id
            AND assignment.employment_period_id = probation.employment_period_id
            AND assignment.organization_id IN (${Prisma.join(organizationIds)})
            AND assignment.archived_at IS NULL
            AND assignment.status IN (${Prisma.join([
              Prisma.sql`${AssignmentStatus.ACTIVE}::"AssignmentStatus"`,
              Prisma.sql`${AssignmentStatus.ENDED}::"AssignmentStatus"`,
            ])})
            AND assignment.start_date <= probation.start_date
            AND (assignment.end_date IS NULL OR assignment.end_date >= probation.start_date)
        )
    `);
    return rows.map(({ id }) => id);
  }

  private currentAssignmentWhere(
    businessDate: Date,
    organizationIds: string[] | undefined,
  ): Prisma.EmployeeAssignmentWhereInput {
    return {
      status: AssignmentStatus.ACTIVE,
      archivedAt: null,
      startDate: { lte: businessDate },
      OR: [{ endDate: null }, { endDate: { gte: businessDate } }],
      employee: {
        is: {
          archivedAt: null,
          recordStatus: RecordStatus.ACTIVE,
        },
      },
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
    };
  }

  private historicalAssignmentWhere(
    businessDate: Date,
    organizationIds: string[] | undefined,
  ): Prisma.EmployeeAssignmentWhereInput {
    return {
      status: { in: [AssignmentStatus.ACTIVE, AssignmentStatus.ENDED] },
      archivedAt: null,
      startDate: { lte: businessDate },
      OR: [{ endDate: null }, { endDate: { gte: businessDate } }],
      ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
    };
  }

  private resolveBusinessDate(value?: string): Date {
    if (value !== undefined && !isStrictBusinessDate(value)) {
      throw new BadRequestException('businessDate must be a valid YYYY-MM-DD date');
    }
    if (value) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day));
    }
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }

  private normalizeOrganizationId(value?: string): string | undefined {
    if (value === undefined) return undefined;
    const normalized = value.trim();
    if (normalized.length > 64) {
      throw new BadRequestException('organizationId must be shorter than or equal to 64 characters');
    }
    return normalized || undefined;
  }

  private formatBusinessDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }
}
