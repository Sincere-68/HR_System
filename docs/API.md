# REST API 概览

运行地址：`http://localhost:3000/api/v1`。交互式 Swagger 位于 `http://localhost:3000/api/docs`，OpenAPI JSON 位于 `http://localhost:3000/api/docs-json`。

除登录外，所有接口需要：

```http
Authorization: Bearer <accessToken>
```

## 认证

### POST `/auth/login`

请求：

```json
{
  "username": "admin",
  "password": "Demo@123"
}
```

响应包含 `accessToken` 和当前用户。JWT 仅保存用户 ID，每次请求由后端重新读取角色、权限和部门范围。

### GET `/auth/me`

返回当前用户：

```json
{
  "id": "...",
  "username": "deptadmin",
  "displayName": "部门管理员",
  "role": "DEPT_ADMIN",
  "roleName": "部门管理员",
  "permissions": [
    "employee.read",
    "employee.create",
    "employee.update",
    "organization.read"
  ],
  "organizationIds": ["...", "..."]
}
```

## 组织

### GET `/organizations`

返回当前账号可使用的部门。拥有 `employee.data.all` 时返回全部部门，否则只返回 `user_data_scopes` 显式配置的部门，不自动递归下级部门。

## 员工

### GET `/employees`

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 姓名或工号模糊搜索，最多 50 个字符 |
| `organizationId` | string | 部门筛选，不能扩大当前用户数据范围 |
| `status` | enum | `PROBATION`、`REGULAR`、`PENDING_ENTRY`、`TRANSFERRED_OUT`、`PENDING_TRANSFER_IN`、`RETIRED`、`RESIGNED` 或 `NON_REGULAR` |
| `page` | integer | 从 1 开始 |
| `pageSize` | integer | 1-100，默认 10 |

响应中的每一项是人员列表快照，按前端文件顺序组合员工主档案、当前任职、主要证件、直线经理、紧急联系人和最高学历。示例仅使用明显虚构的数据：

```json
{
  "data": [
    {
      "id": "employee-id",
      "employeeNo": "FAKE-1001",
      "name": "虚构员工甲",
      "organizationId": "organization-id",
      "organizationName": "产品研发部",
      "entryDate": "2026-01-01",
      "positionName": null,
      "gender": null,
      "personnelPosition": null,
      "jobLevel": null,
      "employeeLevel": null,
      "workplaceName": null,
      "workEmail": null,
      "personalEmail": null,
      "mobile": "13900001001",
      "personnelCategory": "NON_TALENT_PROGRAM",
      "personnelSource": null,
      "employmentStatus": "REGULAR",
      "fullTimeCompany": null,
      "employmentRelationship": "INTERNAL_EMPLOYEE",
      "workArrangement": "CONTRACT_EMPLOYMENT",
      "managerName": null,
      "managerEmail": null,
      "totalWorkYears": null,
      "totalServiceYears": 0.65,
      "documentType": "NATIONAL_ID",
      "documentNumber": "110101200001011001",
      "documentExpiryDate": null,
      "birthDate": null,
      "age": null,
      "ethnicity": null,
      "maritalStatus": null,
      "politicalStatus": null,
      "nativePlace": null,
      "householdType": null,
      "householdAddress": null,
      "residentialAddress": null,
      "emergencyContactName": null,
      "emergencyContactRelationship": null,
      "emergencyContactMobile": null,
      "bankName": null,
      "bankBranchName": null,
      "bankAccountNumber": null,
      "graduationSchoolName": null,
      "institutionType": null,
      "highestEducation": null,
      "graduationDate": null,
      "major": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

`null` 表示该信息尚未录入或当前关系没有对应记录。人员页面固定为 46 个业务字段，列表、详情、新增、编辑与后续导入导出字段注册表使用同一语义；人员子集页面与人员页面没有接口依赖。当前主要任职提供人员定位、职级、员工层级、人员类别、人员来源、雇佣关系和用工形式：人员定位使用固定 code `FRONT_OFFICE`、`MIDDLE_OFFICE`、`BACK_OFFICE`；职级使用固定 code `S1`–`S7`、`E1`–`E7`、`T1`–`T7`、`M1`–`M7`；员工层级使用固定 code `STAFF`、`SUPERVISOR`、`MANAGER`、`DIRECTOR`、`PRESIDENT`、`EXPERT`。三者均直接存于 `EmployeeAssignment` 并由 API 返回 code，前端映射中文标签；职级新增下拉支持按 code 子串搜索（例如输入 `1` 可匹配 `S1`、`E1`、`T1`、`M1`）。全日制公司不是任职字段，`fullTimeCompany` 读取当前任职周期中当前有效 `EmployeeAgreement.employingCompany.name`；无可确认有效协议或目录关系时返回 `null`。人员类别、人员来源、雇佣关系和用工形式分别使用 `personnelCategory`、`personnelSource`、`employmentRelationship`、`workArrangement`，不得相互替代，人员来源不使用 `Candidate.source` 代替。员工主档的户口类别和银行资料、最高教育记录的院校类型也按各自明确来源返回，未录入时为 `null`。人员状态为八项：`PROBATION`、`REGULAR`、`PENDING_ENTRY`、`TRANSFERRED_OUT`、`PENDING_TRANSFER_IN`、`RETIRED`、`RESIGNED`、`NON_REGULAR`；当前有效人员查询只纳入 `PROBATION`、`REGULAR` 和 `NON_REGULAR`。性别只有 `MALE`、`FEMALE`、`UNDISCLOSED`，分别显示男、女、保密。主要证件、紧急联系人、单账户银行资料及最高教育记录分别提供对应快照。由于本系统仅供 HR 使用，有可靠来源的人员字段按正常值返回；访问仍受员工读取权限和组织数据范围约束。

### GET `/employees/regular`

需要 `employee.read`，仅支持 MySQL 模式；Demo 模式返回空分页，不伪造关系型人员数据。

查询参数：`keyword`（姓名或工号）、`organizationId`（组织及全部下级组织）、`page`、`pageSize`。

只返回当前内部正式人员：员工和任职周期均有效且未归档，`employmentRelationship=INTERNAL_EMPLOYEE`、`employmentStatus=REGULAR`、未实际离职、入职日不晚于查询日，并存在当前有效主要任职。该口径不将状态为正式的实习生或劳务人员重复归入正式人员。

响应字段按人员页正式人员表格顺序返回：姓名、工号、入职日期、部门、职位、职级、性别、企业邮箱、用工形式、直线经理、固定 `null` 的简历信息和面试评价、银行、银行账号、开户行支行、全日制公司、`employeeId` 与 `canViewEmployeeDetail`。部门/职位/职级/用工形式读取当前主要 `EmployeeAssignment`；全日制公司读取当前任职周期中当前有效 `EmployeeAgreement.employingCompany.name`；直线经理仅为当前有效主要行政汇报关系。列表组织筛选与人员详情范围独立：筛选不缩小已经拥有的详情访问范围。

### GET `/employees/:id`

返回完整的人员详情契约（含 46 列业务字段和当前关系 ID）；成功查看后写入 `DETAIL_VIEW` 审计。`agreementEmployingCompanyId` 是当前任职周期当前有效合同协议的全日制公司 ID，不属于任职关系字段。Demo 模式没有完整的 MySQL 关系型人员资料，因此会返回同一详情结构，任职、银行、联系人和教育等关系字段为 `null`，不会伪造对应记录。为兼容精简演示数据，若其虚构主档保留旧 `idCardNo`，详情会将其投影为 `NATIONAL_ID` 的证件类型和号码；这不是一条 MySQL 证件关系记录。越权资源统一返回“员工不存在或不在当前数据范围内”，不向请求者确认该 ID 是否真实存在。

### GET `/employees/form-options`

需要 `employee.create` 或 `employee.update` 任一权限。返回新增或编辑员工页面可选择的有效职位、工作地点、直接经理和全日制公司目录；职级是前后端共享的固定 enum，不通过本接口返回。合同及内部公司统一使用全日制公司，不再返回独立的合同签订公司选项。可通过 `excludeEmployeeId` 排除当前员工，经理选项只包含表单需要的员工 ID、姓名和工号。全日制公司目录只返回有效、未归档项。

### POST `/employees`

需要 `employee.create`；目标部门必须在账号数据范围内，`agreementEmployingCompanyId` 必须为有效、未归档的全日制公司目录项。以下示例全部为明显虚构的数据：

```json
{
  "employeeNo": "FAKE-1005",
  "name": "虚构员工甲",
  "workEmail": "fictional.employee@example.invalid",
  "personalEmail": "fictional.personal@example.invalid",
  "gender": "FEMALE",
  "personnelCategory": "NON_TALENT_PROGRAM",
  "employmentRelationship": "INTERNAL_EMPLOYEE",
  "personnelSource": "SOCIAL_RECRUITMENT",
  "workArrangement": "CONTRACT_EMPLOYMENT",
  "mobile": "13900001005",
  "documentType": "NATIONAL_ID",
  "documentNumber": "110101200001015001",
  "documentExpiryDate": "2036-08-25",
  "birthDate": "2000-08-25",
  "ethnicity": "HAN",
  "maritalStatus": "UNMARRIED",
  "politicalStatus": "NON_PARTY",
  "nativePlace": "虚构籍贯",
  "householdType": "LOCAL_URBAN",
  "householdAddress": "虚构户籍所在地",
  "residentialAddress": "虚构联系地址",
  "entryDate": "2026-08-25",
  "organizationId": "部门 ID",
  "positionId": "职位 ID",
  "jobLevel": "S1",
  "workplaceId": "工作地点 ID",
  "personnelPosition": "FRONT_OFFICE",
  "employeeLevel": "STAFF",
  "agreementEmployingCompanyId": "本次合同协议的全日制公司目录 ID",
  "bankName": "ICBC",
  "bankBranchName": "虚构支行",
  "bankAccountNumber": "6222000000000000001",
  "emergencyContactName": "虚构联系人",
  "emergencyContactRelationship": "家属",
  "emergencyContactMobile": "13900002001",
  "graduationSchoolName": "虚构大学",
  "institutionType": "RANK_985",
  "highestEducation": "BACHELOR",
  "graduationDate": "2022-06-30",
  "major": "虚构专业",
  "hasProbation": true,
  "probationMonths": 3,
  "probationEndDate": "2026-11-25",
  "managerEmployeeId": "直接经理员工 ID",
  "contractTermType": "FIXED",
  "contractMonths": 36,
  "contractEndDate": "2029-08-25",
  "employmentStatus": "REGULAR"
}
```

员工、首段任职周期、主要任职、主要证件、当前任职状态和一份 `EmployeeAgreement` 始终在同一事务中创建。`agreementEmployingCompanyId` 必须指向有效、未归档的 `EmployingCompany`，仅写入新建协议的 `employing_company_id`，绝不写入 `EmployeeAssignment`；任一步失败会整体回滚，成功后写一条 `CREATE` 审计。

新增页面中的“邀请激活账号”和“是否部门负责人”目前仅恢复原 UI 并明确禁用，不属于 API 字段。`probationMonths` 用于校验和推导预计试用结束日期，并在创建 `probation_records` 时保存到可空字段 `probation_months`；无试用期或历史记录尚未补录月数时该字段为 `null`。`contractTermType` 为必填：固定期限必须填写月份和终止日期，无固定期限不得填写二者；合同期限月数仅用于校验和推导合同结束日期，不在合同表中重复保存。

合同类型不由新增人员表单选择，而是按 `employmentRelationship` 自动推导：`INTERNAL_EMPLOYEE` 为 `LABOR_CONTRACT`，`INTERN` 为 `INTERNSHIP_AGREEMENT`，`LABOR_WORKER` 为 `LABOR_SERVICE_CONTRACT`。`AgreementType` 完整取值为：`LABOR_CONTRACT`、`LABOR_SERVICE_CONTRACT`、`INTERNSHIP_AGREEMENT`、`OTHER`、`NON_COMPETE_AGREEMENT`、`RETIREE_REEMPLOYMENT_AGREEMENT`、`NON_FULL_TIME_EMPLOYMENT_CONTRACT`、`SPECIAL_AGREEMENT`、`PART_TIME_SERVICE_AGREEMENT`。

## 录用入职

### GET `/onboarding/offers`

需要 `employee.read`，仅支持 MySQL 模式；Demo 模式返回 `409`，不使用精简演示数据伪造 Offer 宽表。接口按当前账号的组织数据范围查询未归档 Offer；没有 `employee.data.all` 时，后端仅返回录用部门在授权组织及其下级组织范围内的记录。

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `view` | enum | `PENDING_SEND`（默认）、`SENT`、`ACCEPTED`、`REJECTED`、`ONBOARDED`、`ALL`。 |
| `page` | integer | 从 1 开始，默认 1。 |
| `pageSize` | integer | 1-100，默认 10。 |

五个业务阶段按以下优先级互斥：`ONBOARDED` 为关联入职单有 `actualEntryDate`；其次 `REJECTED` 为 Offer 状态 `REJECTED` 且尚未入职；`ACCEPTED` 为有接受日期、未拒绝且尚未入职；`SENT` 为有 Offer 发送日期、未接受、未拒绝且尚未入职；其余未归档 Offer 为 `PENDING_SEND`。`ALL` 返回全部未归档 Offer。响应 `meta.viewCounts` 返回同一组织数据范围下待发、已发、已接受、已拒绝、已入职和全部 Offer 的实时数量；分页在后端按当前 `view` 筛选后执行。

字段来源：姓名、个人邮箱、手机号码读取 `Candidate.name/email/mobile`；录用部门、录用职位、工作地点、拟入职日期、试用期、发送日期、接受日期和拒绝原因分别读取 `Offer.organization/position/workplace/proposedEntryDate/probationMonths/issueDate/acceptedAt/rejectedReason`；入职日期读取关联 `OnboardingCase.actualEntryDate`；已入职页面的“邮箱”按用户确认也读取 `Candidate.email`（接口 `personalEmail`）；Offer 状态读取 `Offer.status`。外部应聘职位、Offer 发送人、推荐人、同步状态、拒绝日期、审批状态和当前审批人当前没有可靠来源，均返回 `null`，前端显示 `--`；尤其不能把 `Offer.status` 当作审批状态，也不能用创建/更新时间代替拒绝日期。

当前六个表格均为只读列表，操作列显示禁用的“暂无操作”。

## 任职管理：人员页专属子表

### GET `/employment/personnel-labor-workers`

需要 `employee.read`，仅支持 MySQL 模式；Demo 模式返回空分页。查询参数：`keyword`、`entryDateFrom`、`entryDateTo`、`page`、`pageSize`。

该接口仅供人员页“劳务人员”卡片使用，不替代 `GET /employment/labor-workers`。一行是当前有效主要任职关联的当前劳务任职周期：周期必须为 `employmentRelationship=LABOR_WORKER`、状态为试用/正式/非正式、未实际离职、员工和周期有效未归档；部门范围在后端按当前主要任职所属组织及其全部下级强制执行。

字段为：姓名、电子邮箱（`Employee.workEmail`）、工号、入职日期、部门、职务、职位、用工形式、直线经理、`employeeId` 与 `canViewEmployeeDetail`。职位直接读取同一主职 `EmployeeAssignment.position.name`；不返回工作地点或全日制公司。直线经理只读取当前有效主要行政汇报关系；详情可见性按员工当前数据范围独立计算。

### GET `/employment/personnel-resigned`

需要 `employee.read`，仅支持 MySQL 模式；Demo 模式返回空分页。查询参数：`keyword`、`lastWorkingDateFrom`、`lastWorkingDateTo`、`page`、`pageSize`。

一行是未归档且 `COMPLETED` 的 `TerminationRecord`。部门范围按该离职记录实际最后工作日（没有时计划最后工作日）所在日期、同一任职周期的有效主要任职及组织子树强制判断，不使用员工当前部门。为保留历史，该查询不会因关联员工主档已停用或归档而隐藏仍未归档的完成离职记录。

字段为：工号、姓名、部门、性别、入职日期、离职前职位、离职原因、固定 `null` 的异动类型、最后工作日及实际/计划口径、全日制公司、证件号码、手机号码。全日制公司读取同一任职周期中离职日有效、未归档且未终止的 `EmployeeAgreement.employingCompany.name`；多份协议按生效日期、续签序号、签署日期、创建时间和 ID 稳定选择。此表没有人员详情操作列。

## 数据分析

### GET `/analytics/roster`

需要 `employee.read`，仅支持 MySQL 模式。Demo 模式返回 `409`，不会用精简演示员工伪造宽表字段。

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 姓名或工号模糊搜索，最多 50 个字符 |
| `organizationId` | string | 组织及其所有下级组织；不能扩大当前账号数据范围 |
| `page` | integer | 从 1 开始，默认 1 |
| `pageSize` | integer | 1-100，默认 10 |

员工名册以 `employees` 为分页主表并按唯一工号一人一行，只返回当前在职任职周期。部门、职务、职位、职级和工作地点取当前周期中当前有效的主要任职；范围账号只显示授权组织内的主要任职信息。本系统仅供 HR 使用，有可靠来源的人员字段返回完整值，但访问仍受 `employee.read` 与后端组织数据范围约束。

名册响应包含前端定义的 56 个业务列。当前名册查询未选择户口类别、入党/团日期、参加工作日期、累计工龄、最后工作日和合同期限月数，这些字段返回 `null`；人员类别从当前主要任职读取并回退当前任职周期。累计司龄仅从本次入职日期计算到查询日并保留 1 位小数。试用期月数来自 `probation_records.probation_months`，转正日期来自实际提交的 `confirmed_date`。当前合同排除 `NON_FULL_TIME_EMPLOYMENT_CONTRACT` 后按生效日期及续签顺序稳定选择最新一份；同一员工的多份协议不会产生重复名册行。名册的字段来源与人员列表独立，不能将人员列表已接入的银行、人员来源、院校类型等字段推定为名册已接入。

### PATCH `/employees/:id`

需要 `employee.update`。Body 为允许编辑的人员字段子集；省略字段表示保持不变。当前实现中空字符串按各字段 DTO 校验拒绝或保留，尚未提供显式 `null` 清空语义。部门、职位、职级、人员状态、入离职、重新入职和全日制公司不通过该接口直接修改。人员定位和员工层级分别接受固定 enum code `personnelPosition`、`employeeLevel`，不接受目录 ID；两项与人员类别、雇佣关系、人员来源和用工形式按用户确认直接更新当前主要任职，并写 `employee_field_change_logs` 前后值日志。全日制公司属于协议历史，须通过后续合同协议业务流程维护，不能再写入 `EmployeeAssignment`。证件与最高教育修改同样写字段日志，紧急联系人和单账户银行资料直接更新当前值。编辑页面直接回填并提交完整值，不设置独立的敏感字段权限分支。PATCH 不接受旧兼容输入 `idCardNo`，必须使用 `documentType`、`documentNumber` 和 `documentExpiryDate`。证件类型或号码发生更新时，规范证件记录与兼容字段同步：仅 `NATIONAL_ID` 类型写入 `employees.id_card_no`，其他证件类型将其置为 `null`；仅切换证件类型而不提供号码会被拒绝。创建请求的可选 `jobLevel` 仅允许固定 code `S1`–`S7`、`E1`–`E7`、`T1`–`T7`、`M1`–`M7`；职级变化仍需通过保留任职历史的业务流程处理。

## 权限键

- `employee.read`
- `employee.create`
- `employee.update`
- `employee.data.all`
- `organization.read`

## 错误格式

```json
{
  "statusCode": 403,
  "message": "没有执行此操作的权限",
  "path": "/api/v1/employees",
  "timestamp": "2026-08-20T00:00:00.000Z"
}
```

校验错误的 `message` 可能是字符串数组。常用状态码：

- `400`：请求字段或筛选参数非法
- `401`：未登录、令牌无效或过期
- `403`：缺少操作权限或目标部门不在范围内
- `404`：员工不存在或不在数据范围内
- `409`：工号或身份证号冲突
- `429`：请求过于频繁

## 审计

本期记录：

- `DETAIL_VIEW`
- `CREATE`
- `UPDATE`

`audit_logs.metadata` 只保存 `changedFields` 等变更元数据。手机号、身份证号、密码和 JWT 不写入审计。导出功能本期暂缓，因此虽然数据库枚举预留 `EXPORT`，当前没有导出接口或导出日志。
