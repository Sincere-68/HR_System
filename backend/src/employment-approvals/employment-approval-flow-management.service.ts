import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  PERMISSIONS,
  type ApprovalFlowDefinition,
  type EmploymentApprovalFlowOptions,
  type Paginated,
} from '@hr-demo/shared';
import {
  ApprovalFlowDefinitionStatus,
  ApprovalFlowNodeAssigneeKind,
  ApprovalFlowVersionStatus,
  AuditAction,
  Prisma,
} from '@prisma/client';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreateEmploymentApprovalFlowDefinitionDto,
  CreateEmploymentApprovalFlowVersionDto,
  EmploymentApprovalFlowNodeDto,
  UpdateEmploymentApprovalFlowDefinitionDto,
  UpdateEmploymentApprovalFlowVersionDto,
} from './dto/employment-approval-flow.dto';
import type { QueryEmploymentApprovalFlowsDto } from './dto/query-employment-approval-flows.dto';

type FlowClient = Prisma.TransactionClient;
type DefinitionWithVersions = Prisma.ApprovalFlowDefinitionGetPayload<{
  include: {
    versions: {
      include: { nodes: true };
    };
  };
}>;
type NodeInput = {
  stepOrder: number;
  assigneeKind: ApprovalFlowNodeAssigneeKind;
  assigneeUserId?: string | null;
  assigneeRoleId?: string | null;
  assigneeRule?: unknown;
};

@Injectable()
export class EmploymentApprovalFlowManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(
    user: AuthenticatedUser,
    query: QueryEmploymentApprovalFlowsDto,
  ): Promise<Paginated<ApprovalFlowDefinition>> {
    this.assertPermission(user);
    const where: Prisma.ApprovalFlowDefinitionWhereInput = {
      ...(query.keyword ? {
        OR: [
          { code: { contains: query.keyword } },
          { name: { contains: query.keyword } },
        ],
      } : {}),
      ...(query.businessType ? { businessType: query.businessType } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.approvalFlowDefinition.findMany({
        where,
        include: {
          versions: {
            orderBy: [{ versionNumber: 'asc' }, { id: 'asc' }],
            include: { nodes: { orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }] } },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.approvalFlowDefinition.count({ where }),
    ]);
    return {
      data: (rows as DefinitionWithVersions[]).map((row) => this.presentDefinition(row)),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async findOne(user: AuthenticatedUser, definitionId: string) {
    this.assertPermission(user);
    const definition = await this.prisma.approvalFlowDefinition.findUnique({
      where: { id: definitionId },
      include: {
        versions: {
          orderBy: [{ versionNumber: 'asc' }, { id: 'asc' }],
          include: { nodes: { orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }] } },
        },
      },
    }) as DefinitionWithVersions | null;
    if (!definition) throw new NotFoundException('审批流程定义不存在');
    return this.presentDefinition(definition);
  }

  async findOptions(user: AuthenticatedUser): Promise<EmploymentApprovalFlowOptions> {
    this.assertPermission(user);
    const [users, roles, jobTitles] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where: { status: 'ACTIVE', archivedAt: null },
        select: { id: true, username: true, displayName: true },
        orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.role.findMany({
        select: { id: true, code: true, name: true },
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.jobTitle.findMany({
        where: { status: 'ACTIVE', archivedAt: null },
        select: { id: true, code: true, name: true },
        orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
      }),
    ]);
    return { users, roles, jobTitles };
  }

  async createDefinition(user: AuthenticatedUser, dto: CreateEmploymentApprovalFlowDefinitionDto) {
    this.assertPermission(user);
    const input = this.normalizeDefinition(dto);
    this.assertNodes(input.nodes);

    return this.prisma.$transaction(async (tx) => {
      const definition = await tx.approvalFlowDefinition.create({
        data: {
          businessType: input.businessType,
          code: input.code,
          name: input.name,
          status: ApprovalFlowDefinitionStatus.DRAFT,
        },
      });
      const version = await this.createDraftVersion(tx, definition.id, 1, input.nodes);
      await this.audit.create(
        { userId: user.id },
        AuditAction.CREATE,
        definition.id,
        { resource: 'employment-approval-flow-definition', action: 'create', versionId: version.id },
        tx,
        'employment-approval-flow-definition',
      );
      return this.readDefinition(tx, definition.id);
    });
  }

  async createVersion(user: AuthenticatedUser, definitionId: string, dto: CreateEmploymentApprovalFlowVersionDto) {
    this.assertPermission(user);
    this.assertNodes(dto.nodes);

    return this.prisma.$transaction(async (tx) => {
      const definition = await this.getDefinitionForWrite(tx, definitionId);
      if (definition.status === ApprovalFlowDefinitionStatus.ARCHIVED) {
        throw new ConflictException('已归档流程定义不可创建新版本');
      }
      const latest = await tx.approvalFlowVersion.findFirst({
        where: { definitionId },
        orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
      });
      const version = await this.createDraftVersion(tx, definition.id, (latest?.versionNumber ?? 0) + 1, dto.nodes);
      await this.audit.create(
        { userId: user.id },
        AuditAction.CREATE,
        version.id,
        { resource: 'employment-approval-flow-version', action: 'create', definitionId },
        tx,
        'employment-approval-flow-version',
      );
      return this.readDefinition(tx, definition.id);
    });
  }

  async updateDefinition(user: AuthenticatedUser, definitionId: string, dto: UpdateEmploymentApprovalFlowDefinitionDto) {
    this.assertPermission(user);
    if (dto.nodes) this.assertNodes(dto.nodes);

    return this.prisma.$transaction(async (tx) => {
      const definition = await this.getDefinitionForWrite(tx, definitionId);
      if (definition.status !== ApprovalFlowDefinitionStatus.DRAFT) {
        throw new ConflictException('已发布或已归档流程定义不可修改');
      }
      const updated = await tx.approvalFlowDefinition.update({
        where: { id: definitionId },
        data: dto.name === undefined ? {} : { name: this.normalizeText(dto.name, '流程名称', 191) },
      });
      if (dto.nodes) {
        const draftVersion = await tx.approvalFlowVersion.findFirst({
          where: { definitionId, status: ApprovalFlowVersionStatus.DRAFT },
          orderBy: [{ versionNumber: 'desc' }, { id: 'desc' }],
        });
        if (!draftVersion) throw new ConflictException('流程定义没有可修改的草稿版本');
        await this.replaceNodes(tx, draftVersion.id, dto.nodes);
      }
      await this.audit.create(
        { userId: user.id },
        AuditAction.UPDATE,
        definitionId,
        { resource: 'employment-approval-flow-definition', action: 'update' },
        tx,
        'employment-approval-flow-definition',
      );
      return this.readDefinition(tx, updated.id);
    });
  }

  async updateVersion(user: AuthenticatedUser, versionId: string, dto: UpdateEmploymentApprovalFlowVersionDto) {
    this.assertPermission(user);
    this.assertNodes(dto.nodes);

    return this.prisma.$transaction(async (tx) => {
      const version = await this.getVersionForWrite(tx, versionId);
      if (
        version.status !== ApprovalFlowVersionStatus.DRAFT
        || version.definition.status === ApprovalFlowDefinitionStatus.ARCHIVED
      ) {
        throw new ConflictException('已发布或已归档流程版本不可修改');
      }
      await this.replaceNodes(tx, versionId, dto.nodes);
      await this.audit.create(
        { userId: user.id },
        AuditAction.UPDATE,
        versionId,
        { resource: 'employment-approval-flow-version', action: 'update', definitionId: version.definitionId },
        tx,
        'employment-approval-flow-version',
      );
      return this.readDefinition(tx, version.definitionId);
    });
  }

  async publishVersion(user: AuthenticatedUser, versionId: string) {
    this.assertPermission(user);

    return this.prisma.$transaction(async (tx) => {
      const version = await this.getVersionForWrite(tx, versionId);
      if (
        version.status !== ApprovalFlowVersionStatus.DRAFT
        || version.definition.status === ApprovalFlowDefinitionStatus.ARCHIVED
      ) {
        throw new ConflictException('只有未归档流程定义下的草稿版本可以发布');
      }
      const draftNodes = await tx.approvalFlowNode.findMany({
        where: { flowVersionId: versionId },
        orderBy: { stepOrder: 'asc' },
      });
      this.assertStoredNodes(draftNodes);

      const priorDefinitions = await tx.approvalFlowDefinition.findMany({
        where: {
          businessType: version.definition.businessType,
          status: ApprovalFlowDefinitionStatus.PUBLISHED,
          id: { not: version.definitionId },
        },
        select: { id: true },
      });
      for (const priorDefinition of priorDefinitions) {
        await tx.approvalFlowVersion.updateMany({
          where: { definitionId: priorDefinition.id, status: ApprovalFlowVersionStatus.PUBLISHED },
          data: { status: ApprovalFlowVersionStatus.ARCHIVED },
        });
        await tx.approvalFlowDefinition.update({
          where: { id: priorDefinition.id },
          data: { status: ApprovalFlowDefinitionStatus.ARCHIVED, archivedAt: new Date() },
        });
      }
      await tx.approvalFlowVersion.updateMany({
        where: { definitionId: version.definitionId, status: ApprovalFlowVersionStatus.PUBLISHED },
        data: { status: ApprovalFlowVersionStatus.ARCHIVED },
      });
      await tx.approvalFlowVersion.update({
        where: { id: versionId },
        data: { status: ApprovalFlowVersionStatus.PUBLISHED, publishedAt: new Date() },
      });
      await tx.approvalFlowDefinition.update({
        where: { id: version.definitionId },
        data: { status: ApprovalFlowDefinitionStatus.PUBLISHED, archivedAt: null },
      });
      await this.audit.create(
        { userId: user.id },
        AuditAction.UPDATE,
        versionId,
        {
          resource: 'employment-approval-flow-version',
          action: 'publish',
          definitionId: version.definitionId,
          businessType: version.definition.businessType,
        },
        tx,
        'employment-approval-flow-version',
      );
      return this.readDefinition(tx, version.definitionId);
    });
  }

  async archiveDefinition(user: AuthenticatedUser, definitionId: string) {
    this.assertPermission(user);

    return this.prisma.$transaction(async (tx) => {
      const definition = await this.getDefinitionForWrite(tx, definitionId);
      if (definition.status === ApprovalFlowDefinitionStatus.ARCHIVED) {
        throw new ConflictException('流程定义已经归档');
      }
      await tx.approvalFlowDefinition.update({
        where: { id: definitionId },
        data: { status: ApprovalFlowDefinitionStatus.ARCHIVED, archivedAt: new Date() },
      });
      await tx.approvalFlowVersion.updateMany({
        where: {
          definitionId,
          status: { in: [ApprovalFlowVersionStatus.DRAFT, ApprovalFlowVersionStatus.PUBLISHED] },
        },
        data: { status: ApprovalFlowVersionStatus.ARCHIVED },
      });
      await this.audit.create(
        { userId: user.id },
        AuditAction.UPDATE,
        definitionId,
        { resource: 'employment-approval-flow-definition', action: 'archive' },
        tx,
        'employment-approval-flow-definition',
      );
      return this.readDefinition(tx, definitionId);
    });
  }

  private async createDraftVersion(tx: FlowClient, definitionId: string, versionNumber: number, nodes: NodeInput[]) {
    const version = await tx.approvalFlowVersion.create({
      data: {
        definitionId,
        versionNumber,
        status: ApprovalFlowVersionStatus.DRAFT,
      },
    });
    await tx.approvalFlowNode.createMany({
      data: nodes.map((node) => ({
        flowVersionId: version.id,
        stepOrder: node.stepOrder,
        assigneeKind: node.assigneeKind,
        assigneeUserId: node.assigneeUserId ?? null,
        assigneeRoleId: node.assigneeRoleId ?? null,
        assigneeRule: (node.assigneeRule ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      })),
    });
    return version;
  }

  private async replaceNodes(tx: FlowClient, versionId: string, nodes: NodeInput[]) {
    await tx.approvalFlowNode.deleteMany({ where: { flowVersionId: versionId } });
    await tx.approvalFlowNode.createMany({
      data: nodes.map((node) => ({
        flowVersionId: versionId,
        stepOrder: node.stepOrder,
        assigneeKind: node.assigneeKind,
        assigneeUserId: node.assigneeUserId ?? null,
        assigneeRoleId: node.assigneeRoleId ?? null,
        assigneeRule: (node.assigneeRule ?? Prisma.JsonNull) as Prisma.InputJsonValue,
      })),
    });
  }

  private async readDefinition(tx: FlowClient, definitionId: string) {
    const definition = await tx.approvalFlowDefinition.findUniqueOrThrow({
      where: { id: definitionId },
      include: {
        versions: {
          orderBy: [{ versionNumber: 'asc' }, { id: 'asc' }],
          include: { nodes: { orderBy: [{ stepOrder: 'asc' }, { id: 'asc' }] } },
        },
      },
    });
    return this.presentDefinition(definition as DefinitionWithVersions);
  }

  private presentDefinition(row: DefinitionWithVersions): ApprovalFlowDefinition {
    const published = row.versions.find(({ status }) => status === ApprovalFlowVersionStatus.PUBLISHED);
    return {
      id: row.id,
      businessType: row.businessType,
      code: row.code,
      name: row.name,
      status: row.status,
      currentPublishedVersionId: published?.id ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      versions: row.versions.map((version) => ({
        id: version.id,
        definitionId: version.definitionId,
        versionNumber: version.versionNumber,
        status: version.status,
        publishedAt: version.publishedAt?.toISOString() ?? null,
        createdAt: version.createdAt.toISOString(),
        updatedAt: version.updatedAt.toISOString(),
        nodes: version.nodes.map((node) => ({
          id: node.id,
          versionId: node.flowVersionId,
          stepOrder: node.stepOrder,
          assigneeKind: node.assigneeKind,
          assigneeUserId: node.assigneeUserId,
          assigneeRoleId: node.assigneeRoleId,
          assigneeRule: node.assigneeRule && !Array.isArray(node.assigneeRule) && typeof node.assigneeRule === 'object'
            ? node.assigneeRule as Record<string, unknown>
            : null,
        })),
      })),
    };
  }

  private async getDefinitionForWrite(tx: FlowClient, definitionId: string) {
    const definition = await tx.approvalFlowDefinition.findFirst({ where: { id: definitionId } });
    if (!definition) throw new NotFoundException('审批流程定义不存在');
    return definition;
  }

  private async getVersionForWrite(tx: FlowClient, versionId: string) {
    const version = await tx.approvalFlowVersion.findFirst({
      where: { id: versionId },
      include: { definition: true },
    });
    if (!version) throw new NotFoundException('审批流程版本不存在');
    return version;
  }

  private normalizeDefinition(dto: CreateEmploymentApprovalFlowDefinitionDto) {
    return {
      businessType: this.normalizeText(dto.businessType, '业务类型', 100),
      code: this.normalizeText(dto.code, '流程编码', 191),
      name: this.normalizeText(dto.name, '流程名称', 191),
      nodes: dto.nodes,
    };
  }

  private normalizeText(value: string, label: string, maxLength: number) {
    const normalized = value?.trim();
    if (!normalized) throw new BadRequestException(`${label}不能为空`);
    if (normalized.length > maxLength) throw new BadRequestException(`${label}不能超过 ${maxLength} 个字符`);
    return normalized;
  }

  private assertNodes(nodes: NodeInput[]) {
    if (!nodes.length) throw new UnprocessableEntityException('审批流程版本至少需要一个审批节点');
    const ordered = [...nodes].sort((left, right) => left.stepOrder - right.stepOrder);
    ordered.forEach((node, index) => {
      if (node.stepOrder !== index + 1) throw new UnprocessableEntityException('审批流程节点必须从 1 开始连续排序');
      this.assertNodeAssignee(node);
    });
  }

  private assertStoredNodes(nodes: Array<{
    stepOrder: number;
    assigneeKind: ApprovalFlowNodeAssigneeKind;
    assigneeUserId: string | null;
    assigneeRoleId: string | null;
    assigneeRule: Prisma.JsonValue | null;
  }>) {
    this.assertNodes(nodes.map((node) => ({
      ...node,
      assigneeRule: node.assigneeRule === null ? null : node.assigneeRule,
    })));
  }

  private assertNodeAssignee(node: NodeInput) {
    if (!Object.values(ApprovalFlowNodeAssigneeKind).includes(node.assigneeKind)) {
      throw new UnprocessableEntityException(`第 ${node.stepOrder} 级审批节点类型无效`);
    }
    const hasUser = Boolean(node.assigneeUserId);
    const hasRole = Boolean(node.assigneeRoleId);
    const hasRule = node.assigneeRule !== undefined && node.assigneeRule !== null;
    if (node.assigneeKind === ApprovalFlowNodeAssigneeKind.USER && (!hasUser || hasRole || hasRule)) {
      throw new UnprocessableEntityException(`第 ${node.stepOrder} 级用户审批节点字段无效`);
    }
    if (node.assigneeKind === ApprovalFlowNodeAssigneeKind.ROLE && (!hasRole || hasUser || hasRule)) {
      throw new UnprocessableEntityException(`第 ${node.stepOrder} 级角色审批节点字段无效`);
    }
    if (node.assigneeKind === ApprovalFlowNodeAssigneeKind.DIRECTORY && (hasUser || hasRole || !hasRule || !this.isSupportedDirectoryRule(node.assigneeRule))) {
      throw new UnprocessableEntityException(`第 ${node.stepOrder} 级目录审批节点字段无效`);
    }
  }

  private isSupportedDirectoryRule(rule: unknown): rule is Record<string, unknown> {
    return Boolean(
      rule
      && typeof rule === 'object'
      && !Array.isArray(rule)
      && typeof (rule as Record<string, unknown>).directory === 'string'
      && typeof (rule as Record<string, unknown>).value === 'string'
      && String((rule as Record<string, unknown>).value).trim(),
    );
  }

  private assertPermission(user: AuthenticatedUser) {
    if (!user?.permissions?.includes(PERMISSIONS.EMPLOYMENT_APPROVAL_FLOW_MANAGE)) {
      throw new ForbiddenException('没有管理任职审批流程的权限');
    }
  }
}
