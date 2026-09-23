# 任职管理业务规则与实现说明

> 更新日期：2026-09-23
>
> 适用范围：任职审批流程、实习/劳务转正式、独立兼职职责，以及十个任职管理只读页面的共同权限和日期口径。
>
> 事实优先级：[`CLAUDE.md`](../CLAUDE.md) → [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) 与 migration → shared 契约 → Controller/Service → 本文。若本文与代码不一致，以当前代码和 migration 为准。

## 1. 本期边界

本期已经实现并注册：

1. 任职审批流程定义、版本、节点及发布/归档；
2. 串行多级审批运行时；
3. 实习转正式、劳务转正式申请与显式生效；
4. 独立兼职职责申请、审批、生效和结束；
5. 十个任职入口的 P0 查询、详情、授权计数及显式汇报关系；
6. `hr_personnel_demo_test` 隔离库真实 HTTP 与 PostgreSQL 事务验收。

以下不在本期能力内：

- 并行会签、加签、代理、条件分支和自动跳级；
- 原审批实例内直接修改后重新提交；
- 审批流程导入/导出文件；
- 转换和独立兼职职责的前端写入表单；
- 自动定时生效任务；
- 修改已完成审批历史的管理接口。

## 2. 业务日期

### 2.1 统一口径

- 用户输入的业务日期必须为合法的 `YYYY-MM-DD`。
- “今天”按 `Asia/Shanghai` 日历日计算。
- 数据库存储为 PostgreSQL `DATE`；服务层使用对应 UTC 00:00 的 `Date` 表示日期值，不能把瞬时时间或服务器本地时区混入比较。
- 转换计划生效日和兼职开始日只能为今天或未来日期。

### 2.2 生效时间

- 最终审批通过只进入 `PENDING_EFFECTIVE`，不自动改写正式任职数据。
- 转换只能在 `plannedEffectiveDate <= 上海业务日今天` 时显式生效；提前调用返回 `409`。
- 兼职只能在 `startDate <= 上海业务日今天` 时显式生效；提前调用返回 `409`。
- 当前没有后台调度器；到期后仍需调用对应 `activate` 接口。

## 3. 审批流程定义

### 3.1 对象与版本

- `ApprovalFlowDefinition` 表示某一 `businessType` 的流程定义。
- `ApprovalFlowVersion` 表示定义的不可混用版本。
- `ApprovalFlowNode` 表示按 `stepOrder` 排列的审批节点。
- 定义和版本状态均为 `DRAFT | PUBLISHED | ARCHIVED`。
- 同一业务类型最多一个已发布定义；同一定义最多一个已发布版本，由 PostgreSQL 部分唯一索引兜底。
- 发布新版本时，同一定义的旧发布版本归档；同一业务类型其他已发布定义及其发布版本一并归档。
- 已发布或已归档版本不可修改；归档保留版本和节点历史，不物理删除。

### 3.2 节点规则

节点必须：

- 至少一个；
- 从 1 开始连续排序；
- 每个节点仅配置一种审批人来源。

支持的审批人来源：

| 类型 | 解析规则 |
| --- | --- |
| `USER` | 绑定一个有效且未归档的用户 ID。 |
| `ROLE` | 从该角色的有效账号中按用户 ID 稳定排序，取第一名。 |
| `DIRECTORY` | 当前仅支持 `{ "directory": "JOB_TITLE", "value": "<jobTitleId>" }`；按上海业务日查找拥有该当前有效职务任职且绑定用户的员工，必须唯一匹配。 |

目录规则匹配 0 人返回 `422`，匹配多于 1 人返回 `409`；系统不得猜测审批人。

### 3.3 发布流程选择

提交业务申请时：

- 如果显式给出 `flowVersionId`，该版本必须已发布且属于相同 `businessType` 的已发布定义；
- 未给出版本时，系统要求该业务类型恰好存在一个已发布定义和一个已发布版本；
- 0 个流程返回 `422`；多于 1 个返回 `409`；
- 申请固定绑定提交时的版本，之后发布新版本不会改写既有申请和节点。

流程管理接口需要 `employment.approval-flow.manage`，角色名称本身不等于权限。

## 4. 串行审批状态机

### 4.1 状态字段

`ApprovalRequest` 同时保留：

- 通用流程状态 `ProcessStatus`；
- 任职业务状态 `EmploymentApplicationStatus`。

任职业务状态枚举为：

```text
DRAFT
PENDING
APPROVED
REJECTED
WITHDRAWN
PENDING_EFFECTIVE
COMPLETED
CANCELLED
```

当前主链路不把 `APPROVED` 作为最终审批后的停留状态；最终节点通过时直接进入 `PENDING_EFFECTIVE`。`APPROVED` 仅作为兼容的运行时过渡值保留。

### 4.2 提交与通过

```text
业务草稿/创建
  -> ApprovalRequest(PENDING/PENDING)
  -> 节点 1 APPROVED，申请仍 PENDING/PENDING
  -> ...
  -> 最终节点 APPROVED
  -> ApprovalRequest(APPROVED/PENDING_EFFECTIVE)
  -> 业务记录 PENDING_EFFECTIVE
  -> 显式生效
  -> ApprovalRequest(COMPLETED/COMPLETED)
  -> 转换 COMPLETED 或兼职 ACTIVE
```

规则：

- 只有 `currentStep` 对应的当前审批人可以处理节点；不能越级。
- 中间节点通过只推进 `currentStep`，不得提前改变正式业务数据。
- 最终节点、审批申请及关联业务记录在同一事务中进入待生效。
- 重复处理或并发状态变化通过条件更新检测并返回 `409`。

### 4.3 驳回、撤回、退回修订

| 动作 | 允许者 | 前置条件 | 审批结果 | 业务记录结果 |
| --- | --- | --- | --- | --- |
| 驳回 | 当前审批人 | 申请为待审批 | `REJECTED/REJECTED` | `REJECTED` |
| 撤回 | 申请人 | 所有节点尚未作出决定 | `WITHDRAWN/WITHDRAWN` | `WITHDRAWN` |
| 退回修订 | 当前审批人 | 申请为待审批，意见必填 | 当前节点 `SKIPPED`；原申请 `WITHDRAWN/DRAFT` | `DRAFT` |

退回修订不会重置或覆盖原审批步骤。当前业务模块尚未提供从 `DRAFT` 原地重新提交的接口；后续修订应创建新申请，并永久保留旧申请历史。

### 4.4 生效完成

- 只有全部节点均为 `APPROVED`、审批为 `APPROVED/PENDING_EFFECTIVE` 时可完成生效。
- `completeEffectiveInTransaction` 必须由业务模块在同一个事务中调用。
- 正式业务写入失败时，审批不得单独变为 `COMPLETED`。

## 5. 审批可见性与操作权限

### 5.1 列表

- `GET /employment-approvals/my` 只返回本人发起的任职审批。
- `GET /employment-approvals/current` 只返回本人当前待处理节点对应的申请。

### 5.2 详情

任职审批详情满足任一条件即可读取：

1. 当前用户是申请人；
2. 当前用户是任一审批步骤参与者，包括已处理和待处理节点；
3. 同时拥有 `employee.read` 与 `employee.data.all`；
4. 拥有 `employee.read` 且关联业务对象处于当前用户“本部门及全部下级组织”范围。

业务范围判定：

- 转换审批：创建时不可变的 `sourceSnapshot.assignment.organizationId` 和目标组织必须都在范围内；不能因源周期曾经出现过范围内任职而误授权。
- 兼职审批：员工当前有效任职和兼职目标组织必须都在范围内。
- 未参与且范围外的账号返回 `403`。

审批处理权与详情读取权分离；能查看不表示能审批，只有当前节点审批人可以处理。

## 6. 实习/劳务转正式

### 6.1 申请校验

- 源周期必须有效、未归档，并与 `employeeId` 一致。
- 仅 `INTERN` 可提交 `INTERN_TO_EMPLOYEE`；仅 `LABOR_WORKER` 可提交 `LABOR_TO_EMPLOYEE`。
- 源周期必须存在当前有效主要任职。
- 源组织和目标组织都必须在操作人的数据范围内。
- 目标组织、职位、职务必须有效且未归档。
- 同一源周期只能有一笔未归档的开放转换：`DRAFT | PENDING | APPROVED | PENDING_EFFECTIVE`；服务校验和 PostgreSQL 部分唯一索引共同保证。

### 6.2 快照和创建事务

转换申请保存：

- 源员工、周期和任职快照；
- 目标组织、职位、职务、职级和计划生效日快照。

以下步骤在同一 Prisma 事务中执行：

1. 创建 `EmploymentConversion(DRAFT)`；
2. 绑定已发布流程版本并创建审批申请和全部节点；
3. 回写 `approvalRequestId`；
4. 转换状态改为 `PENDING`。

审批流程不可用、节点解析失败或写入失败时，转换记录和审批记录全部回滚。

### 6.3 生效日期边界

令计划生效日为 `D`：

- 原周期 `actualExitDate = D - 1`；
- 原周期人员状态改为 `TRANSFERRED_OUT`；
- 原周期全部有效任职 `endDate = D - 1` 且状态改为 `ENDED`；
- 原当前人员状态 `endedAt = D - 1`、`currentFlag = false`；
- 新正式周期、主要任职和正式人员状态均从 `D` 开始；
- 新周期关联 `previousPeriodId`，保留转换链路；
- 新任职关系为 `INTERNAL_EMPLOYEE + PRIMARY + CONTRACT_EMPLOYMENT`；
- 迁移期兼容字段 `Employee.organizationId` 同步为目标组织。

如果 `D - 1` 早于源周期入职日或源任职开始日，阻断生效。这样不会出现同一天旧、新两个有效部门任职。

### 6.4 生效事务与重复调用

以下操作在一个事务内完成：

- 条件结束源周期、源任职和源当前状态；
- 创建新周期、新主要任职和新正式状态；
- 更新兼容组织字段；
- 转换 `PENDING_EFFECTIVE -> COMPLETED`；
- 审批 `APPROVED/PENDING_EFFECTIVE -> COMPLETED/COMPLETED`。

任何一步失败，全部回滚。已完成转换再次生效返回 `409`，不重复创建周期或任职。

## 7. 独立兼职职责

### 7.1 模型边界

`PartTimeRecord` 表示独立兼职职责申请，不替代 `EmployeeAssignment` 的主要部门任职，不会创建第二条主要任职。字段包括：

- 员工；
- 兼职类型；
- 可选机构；
- 职责部门；
- 可选职务；
- 可选兼职经理；
- 开始/结束日期；
- 状态和审批引用。

状态为：

```text
DRAFT | PENDING | REJECTED | WITHDRAWN | PENDING_EFFECTIVE | ACTIVE | ENDED | CANCELLED
```

### 7.2 创建规则

- 需要 `employee.update`。
- 员工必须在当前用户数据范围内。
- 职责部门必须在范围内且有效。
- 职务必须有效。
- 经理可以跨部门，但必须是有效员工且不能是本人。
- `endDate` 不得早于 `startDate`。
- 相同员工、机构、部门和职务的非终态日期区间不得重叠；`null` 参与严格等值语义。
- 创建兼职、创建审批、回写审批引用和审计在同一事务中完成；没有可用已发布流程时整笔回滚。

### 7.3 审批、生效与结束

```text
PENDING
  -> 最终审批 PENDING_EFFECTIVE
  -> 到达开始日后显式 activate
  -> ACTIVE
  -> 显式 end
  -> ENDED
```

- 最终审批前不能生效。
- 开始日未到不能生效。
- 生效将业务记录改为 `ACTIVE`，同时将审批改为 `COMPLETED/COMPLETED`。
- `ACTIVE` 重复生效返回当前记录，不重复写入。
- 只有 `ACTIVE` 可以结束，结束日不得早于开始日。
- `ENDED` 重复结束返回当前记录，不改写原历史。
- 驳回、撤回和退回修订分别同步为 `REJECTED`、`WITHDRAWN`、`DRAFT`。

### 7.4 兼职数据范围和经理裁剪

- 列表和详情同时要求员工当前组织及兼职目标组织在范围内。
- 范围外记录按不存在处理，详情返回 `404`。
- 跨范围经理可以被业务记录引用，但返回列表/详情时会裁剪经理 ID 和经理摘要，避免泄漏范围外人员信息。

## 8. 事务、并发、幂等与审计

### 8.1 事务边界

必须同事务：

- 转换记录 + 审批申请创建；
- 兼职记录 + 审批申请创建；
- 最终审批 + 业务记录进入待生效；
- 驳回/撤回/退回 + 业务状态同步；
- 转换正式数据写入 + 转换完成 + 审批完成；
- 兼职激活 + 审批完成 + 审计。

### 8.2 并发控制

当前没有通用 `version` 字段，使用以下方式控制并发：

- 唯一索引：已发布流程、流程版本、源周期开放转换、审批引用；
- `updateMany` 带原状态/currentStep/未归档条件，要求 `count === 1`；
- 不满足条件返回 `409`，提示刷新重试。

### 8.3 幂等规则

| 操作 | 重复结果 |
| --- | --- |
| 审批节点处理 | 拒绝；已不是当前待处理节点。 |
| 转换生效 | `409`；不创建重复周期。 |
| 兼职生效 | 已为 `ACTIVE` 时返回当前记录。 |
| 兼职结束 | 已为 `ENDED` 时返回当前记录。 |
| 标记待生效 | 已为 `PENDING_EFFECTIVE` 时返回当前状态。 |

### 8.4 审计

流程定义创建、版本发布、审批申请创建/审批/驳回/撤回/退回/完成，以及兼职创建/生效/结束写入 `audit_logs`。审计记录业务类型、业务 ID、流程版本、前后状态、节点序号和动作；审批步骤和历史业务行不做无痕覆盖或物理删除。

## 9. 数据库约束与迁移

Foundation migration：

```text
backend/prisma/migrations/20260918190000_employment_business_foundation
```

关键约束：

- 同一业务类型一个已发布流程定义；
- 同一定义一个已发布版本；
- 同版本 `step_order` 唯一；
- 转换和兼职各自的 `approval_request_id` 唯一；
- 同一源周期只能有一笔开放转换；
- 外键删除策略均保守使用 `RESTRICT`，审批步骤随审批申请 `CASCADE` 的既有规则除外；
- 权限目录由 migration 独立安装，不依赖清理型演示 seed。

## 10. 隔离库验收基线

2026-09-23 仅在本机 `hr_personnel_demo_test` 执行：

- 16 个 migrations，schema up to date；
- 3 个两级发布流程；
- 10 个申请、20 个审批步骤；
- 5 个转换、5 个兼职职责；
- 39 条相关审计；
- 无流程创建回滚、两级审批、权限、驳回、撤回、退回、待生效、生效、结束、重复调用及故障注入事务回滚全部通过；
- 主库 `hr_personnel_demo` 未应用 Foundation migration，且没有 `MOCK-HR-STAGE2-*` 数据。

受保护脚本：

- `backend/prisma/seed-employment-foundation-smoke.ts`
- `backend/prisma/smoke-employment-foundation.py`

脚本只允许本机 `hr_personnel_demo_test`，使用 `MOCK-HR-STAGE2-*` 虚构命名空间，不运行 `backend/prisma/seed.ts`。

## 11. 已知限制与后续决策

1. 转换列表服务目前按源周期任职关系查询范围；审批详情已改用创建时源组织快照。若未来允许源周期内多次跨部门转换，列表也应改为快照授权。
2. 独立兼职职责与原 P0 `GET /employment/part-time`（基于 `EmployeeAssignment.workArrangement=PART_TIME`）是两套来源；前端尚未切换到新写入底座。
3. 退回修订后没有原记录重新提交接口；当前只保留 `DRAFT` 业务记录和关闭的原审批。
4. 流程管理目前提供创建、修改、发布、归档 API，但没有查询列表、导入或导出 API。
5. 没有自动到期生效任务，HR 必须显式调用生效接口。
6. 转换生效会结束源周期全部有效任职；这符合当前“同一时间仅一个部门”的项目规则。若未来允许源周期内额外任职，需重新定义结束范围。
7. `CANCELLED` 和兼容状态 `APPROVED` 已预留，但当前 Controller 没有直接进入这些状态的动作。
