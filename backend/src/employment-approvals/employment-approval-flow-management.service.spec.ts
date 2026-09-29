import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  ApprovalFlowDefinitionStatus,
  ApprovalFlowNodeAssigneeKind,
  ApprovalFlowVersionStatus,
  Prisma,
} from '@prisma/client';
import { EmploymentApprovalFlowManagementService } from './employment-approval-flow-management.service';

const manager = { id: 'manager-1', permissions: ['employment.approval-flow.manage'] } as never;

const userNode = (stepOrder: number, assigneeUserId = 'approver-1') => ({
  stepOrder,
  assigneeKind: ApprovalFlowNodeAssigneeKind.USER,
  assigneeUserId,
  assigneeRoleId: null,
  assigneeRule: null,
});

function createHarness() {
  const definitions: any[] = [];
  const versions: any[] = [];
  const nodes: any[] = [];
  let definitionSequence = 0;
  let versionSequence = 0;
  let nodeSequence = 0;
  const calls: string[] = [];

  const tx = {
    approvalFlowDefinition: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const row = {
          id: `definition-${++definitionSequence}`,
          ...data,
          status: ApprovalFlowDefinitionStatus.DRAFT,
          archivedAt: null,
          versions: [],
          createdAt: new Date('2026-09-18T00:00:00.000Z'),
          updatedAt: new Date('2026-09-18T00:00:00.000Z'),
        };
        definitions.push(row);
        calls.push('definition.create');
        return Promise.resolve(row);
      }),
      findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
        definitions.find((row) => row.id === where.id && (where.archivedAt === undefined || row.archivedAt === where.archivedAt)) ?? null,
      )),
      findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
        definitions.filter((row) => row.businessType === where.businessType && row.status === where.status && row.id !== where.id?.not).map((row) => ({ id: row.id })),
      )),
      findUniqueOrThrow: jest.fn().mockImplementation(({ where }: any) => {
        const definition = definitions.find((row) => row.id === where.id);
        return Promise.resolve({
          ...definition,
          versions: versions
            .filter((version) => version.definitionId === where.id)
            .map((version) => ({
              ...version,
              nodes: nodes.filter((node) => node.flowVersionId === version.id),
            })),
        });
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        calls.push('definition.update');
        const row = definitions.find((candidate) => candidate.id === where.id);
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
    },
    approvalFlowVersion: {
      create: jest.fn().mockImplementation(({ data }: any) => {
        const row = {
          id: `version-${++versionSequence}`,
          ...data,
          status: ApprovalFlowVersionStatus.DRAFT,
          publishedAt: null,
          nodes: [],
          createdAt: new Date('2026-09-18T00:00:00.000Z'),
          updatedAt: new Date('2026-09-18T00:00:00.000Z'),
        };
        versions.push(row);
        const definition = definitions.find((candidate) => candidate.id === data.definitionId);
        definition.versions.push(row);
        calls.push('version.create');
        return Promise.resolve(row);
      }),
      findFirst: jest.fn().mockImplementation(({ where, include }: any) => {
        const row = versions.find((candidate) => candidate.id === where.id)
          ?? versions.find((candidate) => candidate.definitionId === where.definitionId && (!where.status || candidate.status === where.status));
        if (!row) return Promise.resolve(null);
        return Promise.resolve(include?.definition
          ? { ...row, definition: definitions.find((definition) => definition.id === row.definitionId) }
          : row);
      }),
      findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
        versions.filter((row) => row.definitionId === where.definitionId),
      )),
      updateMany: jest.fn().mockImplementation(({ where, data }: any) => {
        calls.push('version.updateMany');
        const matching = versions.filter((row) => row.definitionId === where.definitionId && row.status === where.status);
        matching.forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: matching.length });
      }),
      update: jest.fn().mockImplementation(({ where, data }: any) => {
        calls.push('version.update');
        const row = versions.find((candidate) => candidate.id === where.id);
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
    },
    approvalFlowNode: {
      findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(
        nodes.filter((node) => node.flowVersionId === where.flowVersionId),
      )),
      createMany: jest.fn().mockImplementation(({ data }: any) => {
        data.forEach((input: any) => {
          const row = {
            id: `node-${++nodeSequence}`,
            ...input,
            assigneeRule: input.assigneeRule === null || input.assigneeRule === Prisma.JsonNull ? null : input.assigneeRule,
            createdAt: new Date('2026-09-18T00:00:00.000Z'),
            updatedAt: new Date('2026-09-18T00:00:00.000Z'),
          };
          nodes.push(row);
          const version = versions.find((candidate) => candidate.id === input.flowVersionId);
          version.nodes.push(row);
        });
        calls.push('node.createMany');
        return Promise.resolve({ count: data.length });
      }),
      deleteMany: jest.fn().mockImplementation(({ where }: any) => {
        calls.push('node.deleteMany');
        const retained = nodes.filter((row) => row.flowVersionId !== where.flowVersionId);
        nodes.length = 0;
        nodes.push(...retained);
        return Promise.resolve({ count: 0 });
      }),
    },
  };

  const prisma = {
    $transaction: jest.fn().mockImplementation((callback: (client: typeof tx) => unknown) => callback(tx)),
    approvalFlowDefinition: tx.approvalFlowDefinition,
    approvalFlowVersion: tx.approvalFlowVersion,
    approvalFlowNode: tx.approvalFlowNode,
  };
  const audit = { create: jest.fn().mockResolvedValue(undefined) };
  const service = new EmploymentApprovalFlowManagementService(prisma as never, audit as never);
  return { service, prisma, tx, definitions, versions, nodes, calls };
}

describe('EmploymentApprovalFlowManagementService', () => {
  it('creates a draft definition, version, and contiguous nodes', async () => {
    const { service, tx, definitions, versions, nodes } = createHarness();

    const result = await service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'employment-change',
      name: '任职异动审批',
      nodes: [userNode(1), userNode(2, 'approver-2')],
    });

    expect(result.status).toBe(ApprovalFlowDefinitionStatus.DRAFT);
    expect(versions[0]).toMatchObject({
      definitionId: definitions[0].id,
      versionNumber: 1,
      status: ApprovalFlowVersionStatus.DRAFT,
    });
    expect(nodes.map((node) => node.stepOrder)).toEqual([1, 2]);
    expect(tx.approvalFlowNode.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ flowVersionId: versions[0].id, stepOrder: 1 }),
        expect.objectContaining({ flowVersionId: versions[0].id, stepOrder: 2 }),
      ]),
    });
  });

  it.each([
    { name: 'rejects non-contiguous nodes', nodes: [userNode(1), userNode(3)] },
    { name: 'rejects a zero-based first node', nodes: [userNode(0)] },
  ])('$name', async ({ nodes }) => {
    const { service } = createHarness();

    await expect(service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: `invalid-${nodes[0]!.stepOrder}`,
      name: '无效流程',
      nodes,
    })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it.each([
    { name: 'rejects a USER node without a user', node: { ...userNode(1), assigneeUserId: null } },
    { name: 'rejects a ROLE node with a user field', node: { ...userNode(1), assigneeKind: ApprovalFlowNodeAssigneeKind.ROLE, assigneeRoleId: 'role-1' } },
    { name: 'rejects a DIRECTORY node without a rule', node: { ...userNode(1), assigneeKind: ApprovalFlowNodeAssigneeKind.DIRECTORY, assigneeUserId: null } },
  ])('$name', async ({ node }) => {
    const { service } = createHarness();

    await expect(service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: `invalid-assignee-${node.assigneeKind}`,
      name: '无效审批人',
      nodes: [node],
    })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects an assignee kind outside the schema enum', async () => {
    const { service } = createHarness();
    const node = {
      ...userNode(1),
      assigneeKind: 'UNSUPPORTED' as unknown as ApprovalFlowNodeAssigneeKind,
    };

    await expect(service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'invalid-assignee-kind',
      name: '无效审批类型',
      nodes: [node],
    })).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('rejects creating a version under an archived definition', async () => {
    const { service, definitions, versions } = createHarness();
    await service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'archived-definition-new-version',
      name: '已归档流程',
      nodes: [userNode(1)],
    });
    definitions[0].status = ApprovalFlowDefinitionStatus.ARCHIVED;

    await expect(service.createVersion(manager, definitions[0].id, {
      nodes: [userNode(1)],
    })).rejects.toBeInstanceOf(ConflictException);
    expect(versions).toHaveLength(1);
  });

  it('allows editing a new draft version under a published definition', async () => {
    const { service, definitions, versions, nodes } = createHarness();
    await service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'published-definition-new-draft',
      name: '已发布流程',
      nodes: [userNode(1)],
    });
    definitions[0].status = ApprovalFlowDefinitionStatus.PUBLISHED;
    versions[0].status = ApprovalFlowVersionStatus.PUBLISHED;

    await service.createVersion(manager, definitions[0].id, {
      nodes: [userNode(1), userNode(2)],
    });
    await expect(service.updateVersion(manager, versions[1].id, {
      nodes: [userNode(1), userNode(2), userNode(3)],
    })).resolves.toBeDefined();
    expect(nodes.filter((node) => node.flowVersionId === versions[1].id)).toHaveLength(3);
  });

  it('does not permit editing a published version', async () => {
    const { service, definitions, versions } = createHarness();
    await service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'published-edit',
      name: '已发布流程',
      nodes: [userNode(1)],
    });
    definitions[0].status = ApprovalFlowDefinitionStatus.PUBLISHED;
    versions[0].status = ApprovalFlowVersionStatus.PUBLISHED;

    await expect(service.updateVersion(manager, versions[0].id, {
      nodes: [userNode(1), userNode(2)],
    })).rejects.toBeInstanceOf(ConflictException);
  });

  it('publishes atomically while archiving the previous definition and version', async () => {
    const { service, prisma, tx, definitions, versions, calls } = createHarness();
    await service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'first-definition',
      name: '旧流程',
      nodes: [userNode(1)],
    });
    definitions[0].status = ApprovalFlowDefinitionStatus.PUBLISHED;
    versions[0].status = ApprovalFlowVersionStatus.PUBLISHED;

    const second = await service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'second-definition',
      name: '新流程',
      nodes: [userNode(1), userNode(2)],
    });
    const published = await service.publishVersion(manager, second.versions[0].id);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(calls.slice(-4)).toEqual([
      'definition.update',
      'version.updateMany',
      'version.update',
      'definition.update',
    ]);
    expect(definitions[0]).toMatchObject({ status: ApprovalFlowDefinitionStatus.ARCHIVED });
    expect(versions[0]).toMatchObject({ status: ApprovalFlowVersionStatus.ARCHIVED });
    expect(published).toMatchObject({ status: ApprovalFlowVersionStatus.PUBLISHED });
    expect(definitions[1]).toMatchObject({ status: ApprovalFlowDefinitionStatus.PUBLISHED });
  });

  it('archives definitions without deleting their versions or nodes', async () => {
    const { service, tx, definitions, versions, nodes } = createHarness();
    await service.createDefinition(manager, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'archive-definition',
      name: '待归档流程',
      nodes: [userNode(1)],
    });

    await service.archiveDefinition(manager, definitions[0].id);

    expect(tx.approvalFlowDefinition.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: definitions[0].id },
      data: expect.objectContaining({ status: ApprovalFlowDefinitionStatus.ARCHIVED }),
    }));
    expect(definitions).toHaveLength(1);
    expect(versions).toHaveLength(1);
    expect(nodes).toHaveLength(1);
  });

  it('rejects flow writes without the management permission', async () => {
    const { service } = createHarness();
    const unauthorized = { id: 'viewer', permissions: [] } as never;

    await expect(service.createDefinition(unauthorized, {
      businessType: 'EMPLOYMENT_CHANGE',
      code: 'forbidden',
      name: '无权限流程',
      nodes: [userNode(1)],
    })).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('EmploymentApprovalFlowManagementService reads', () => {
  const publishedDefinition = {
    id: 'definition-1',
    businessType: 'INTERN_TO_EMPLOYEE',
    code: 'intern-conversion',
    name: '实习转正式审批',
    status: ApprovalFlowDefinitionStatus.PUBLISHED,
    archivedAt: null,
    createdAt: new Date('2026-09-20T00:00:00.000Z'),
    updatedAt: new Date('2026-09-22T00:00:00.000Z'),
    versions: [{
      id: 'version-1',
      definitionId: 'definition-1',
      versionNumber: 1,
      status: ApprovalFlowVersionStatus.PUBLISHED,
      publishedAt: new Date('2026-09-21T00:00:00.000Z'),
      createdAt: new Date('2026-09-20T00:00:00.000Z'),
      updatedAt: new Date('2026-09-21T00:00:00.000Z'),
      nodes: [{
        id: 'node-1',
        flowVersionId: 'version-1',
        stepOrder: 1,
        assigneeKind: ApprovalFlowNodeAssigneeKind.USER,
        assigneeUserId: 'approver-1',
        assigneeRoleId: null,
        assigneeRule: null,
        createdAt: new Date('2026-09-20T00:00:00.000Z'),
        updatedAt: new Date('2026-09-20T00:00:00.000Z'),
      }],
    }],
  };

  function createReadSubject() {
    const prisma = {
      approvalFlowDefinition: {
        findMany: jest.fn().mockResolvedValue([publishedDefinition]),
        count: jest.fn().mockResolvedValue(1),
        findUnique: jest.fn().mockResolvedValue(publishedDefinition),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'approver-1', username: 'mock-approver', displayName: '虚构审批人' },
        ]),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'role-1', code: 'DEPT_ADMIN', name: '部门管理员' },
        ]),
      },
      jobTitle: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'job-title-1', code: 'HRBP', name: 'HRBP' },
        ]),
      },
      $transaction: jest.fn((queries: unknown[]) => Promise.all(queries)),
    };
    return {
      prisma,
      service: new EmploymentApprovalFlowManagementService(
        prisma as never,
        { create: jest.fn() } as never,
      ),
    };
  }

  it('filters and paginates definitions with stable ordering and public node fields', async () => {
    const { service, prisma } = createReadSubject();

    const result = await service.findAll(manager, {
      keyword: '转正式',
      businessType: 'INTERN_TO_EMPLOYEE',
      status: ApprovalFlowDefinitionStatus.PUBLISHED,
      page: 2,
      pageSize: 10,
    });

    expect(prisma.approvalFlowDefinition.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        businessType: 'INTERN_TO_EMPLOYEE',
        status: ApprovalFlowDefinitionStatus.PUBLISHED,
        OR: [
          { code: { contains: '转正式' } },
          { name: { contains: '转正式' } },
        ],
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: 10,
      take: 10,
    }));
    expect(result.meta).toEqual({ page: 2, pageSize: 10, total: 1, totalPages: 1 });
    expect(result.data[0]).toEqual(expect.objectContaining({
      id: 'definition-1',
      currentPublishedVersionId: 'version-1',
      createdAt: '2026-09-20T00:00:00.000Z',
      updatedAt: '2026-09-22T00:00:00.000Z',
      versions: [expect.objectContaining({
        id: 'version-1',
        nodes: [expect.objectContaining({ id: 'node-1', versionId: 'version-1' })],
      })],
    }));
    expect(result.data[0]!.versions[0]!.nodes[0]).not.toHaveProperty('flowVersionId');
  });

  it('reads archived definitions with all versions and nodes for history', async () => {
    const { service, prisma } = createReadSubject();
    prisma.approvalFlowDefinition.findUnique.mockResolvedValue({
      ...publishedDefinition,
      status: ApprovalFlowDefinitionStatus.ARCHIVED,
      archivedAt: new Date('2026-09-23T00:00:00.000Z'),
    });

    const result = await service.findOne(manager, 'definition-1');

    expect(prisma.approvalFlowDefinition.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'definition-1' },
    }));
    expect(result).toEqual(expect.objectContaining({
      id: 'definition-1',
      status: ApprovalFlowDefinitionStatus.ARCHIVED,
      versions: [expect.objectContaining({ nodes: [expect.objectContaining({ stepOrder: 1 })] })],
    }));
  });

  it('returns minimal active user, role, and job-title configuration options', async () => {
    const { service, prisma } = createReadSubject();

    const result = await service.findOptions(manager);

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', archivedAt: null },
      select: { id: true, username: true, displayName: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.role.findMany).toHaveBeenCalledWith({
      select: { id: true, code: true, name: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    });
    expect(prisma.jobTitle.findMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE', archivedAt: null },
      select: { id: true, code: true, name: true },
      orderBy: [{ name: 'asc' }, { code: 'asc' }, { id: 'asc' }],
    });
    expect(result).toEqual({
      users: [{ id: 'approver-1', username: 'mock-approver', displayName: '虚构审批人' }],
      roles: [{ id: 'role-1', code: 'DEPT_ADMIN', name: '部门管理员' }],
      jobTitles: [{ id: 'job-title-1', code: 'HRBP', name: 'HRBP' }],
    });
  });

  it('rejects every read without the flow-management permission', async () => {
    const { service, prisma } = createReadSubject();
    const unauthorized = { id: 'viewer', permissions: [] } as never;

    await expect(service.findAll(unauthorized, { page: 1, pageSize: 10 }))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.findOne(unauthorized, 'definition-1'))
      .rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.findOptions(unauthorized))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.approvalFlowDefinition.findMany).not.toHaveBeenCalled();
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });
});
