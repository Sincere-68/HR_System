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
          const row = { id: `node-${++nodeSequence}`, ...input, assigneeRule: input.assigneeRule === null || input.assigneeRule === Prisma.JsonNull ? null : input.assigneeRule };
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
