# HR 系统项目进展快照

> 快照日期：2026-08-28
>
> 本文用于新对话接续，记录当前代码已经实现的页面、接口、字段来源、查询口径、验证结果和已知限制。若本文与当前代码不一致，以 [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma)、shared 契约和实际前后端代码为准；本文不替代业务约束、Prisma Migration 或 API 源码。

## 一、项目概况

- 前端：React 19、TypeScript、Vite、Ant Design、React Router、TanStack Query。
- 后端：NestJS、Prisma ORM、PostgreSQL、JWT、DTO 校验和 Swagger。
- 共享层：[`shared/src/index.ts`](../shared/src/index.ts) 定义前后端共用的查询参数、分页结构、列表字段和枚举。
- npm workspaces：`frontend`、`backend`、`shared`。
- REST API 全局前缀：`/api/v1`；Swagger 路径：`/api/docs`。
- `DEMO_MODE=true` 仅为免数据库精简演示，完整 HR 模块和字段以 PostgreSQL 数据库模式为准。
- 前端基础表格页面的格式、布局、间距、交互样式和字体大小统一以“人员”页面为标准；新列表优先复用其筛选栏、表格、勾选、分页、空状态和操作列样式。

## 二、事实来源与字段实现规则

字段核对优先级如下：

1. Prisma schema 与 migration：数据库对象、字段、关系和枚举。
2. shared 契约：API 对外字段名、可空性和分页结构。
3. 后端 controller/service/presenter：查询范围、组合口径和实际返回值。
4. 前端路由、页面及列配置：列顺序、标题、占位和操作行为。
5. 本文及其他 docs：接续说明；发现滞后时不能反向覆盖代码事实。

统一约定：

- 页面列按用户提供的顺序保留。
- 有明确模型、关系或已确认计算口径的列才接入真实数据。
- 没有可靠来源或业务含义尚未确认的列，shared/API 使用 `null`，前端显示 `--`。
- 禁止用编码、创建时间或其他相似字段冒充缺失字段。
- 普通列表“邮箱/电子邮箱”默认读取 `Employee.workEmail`（`employees.work_email`）。
- “个人邮箱”读取 `Employee.personalEmail`；“直线经理邮箱”读取主要经理的 `Employee.workEmail`；Offer 候选人个人邮箱读取 `Candidate.email`。
- 本系统仅供 HR 使用，不设置独立的字段级敏感权限；有可靠来源的字段按正常值返回，仍受员工读取权限和组织数据范围约束。

## 三、核心数据模型口径

| 业务对象 | Prisma 模型 | 当前口径 |
|---|---|---|
| 自然人长期主档案 | `Employee` | 同一自然人离职再入职沿用原主档案和原工号。 |
| 任职周期 | `EmploymentPeriod` | 每次入职、离职、重新入职分别保存；人员类别、人员来源、雇佣关系和八项人员状态按周期保留历史。 |
| 部门任职 | `EmployeeAssignment` | 员工同一时间不同时属于多个部门；不同时间的部门变化通过独立任职历史保存，当前仅有一条有效部门任职。包含组织、岗位、职级、职务、地点、起止日期和状态；部门与职位相互独立。 |
| 组织树 | `Organization` | 当前测试目录为四层组织树，根为上海宜信电子商务有限公司，第二层为 CEO陈锐/董事长陈钢分组；组织范围包含选中组织及其所有下级。旧演示组织属于测试数据，可由受保护的组织目录替换脚本直接删除；正式业务组织仍不得物理删除。 |
| 汇报关系 | `ReportingRelationship` | 同一时点最多一个主要上级，主要上级可为空；其他关系类型按业务配置。上级可跨部门或来自组织层级中的下级人员；禁止自我及循环关系，离职转交通过结束旧关系并创建指定人员的新关系保留历史。 |
| 人员状态历史 | `EmploymentRecord` | 状态按生效和结束时间保存；历史任职列表按任职业务日期解析状态。 |
| 合同协议 | `EmployeeAgreement` | 独立关联员工及任职周期；内部公司只通过 `employingCompany` 全日制公司目录保存协议历史，保存类型、起止和终止日期。 |
| 附属资料 | 多个独立模型 | 证件、家庭、教育、履历、考核、培训、奖励、证书、项目、技能、语言等均是一对多记录。 |

### 当前与历史查询

- 人员列表、员工名册、合同、实习生、劳务人员和兼职管理以当前有效记录为主要口径。
- 任职记录支持 `view=current` 与 `view=history`：当前视图只查当前有效任职；历史视图可查已经结束、停用或归档的业务任职记录。
- 试用、异动、试岗、离职和退休按各自业务记录查询，不因员工后来换部门而覆盖历史。
- 历史行的组织可见性按该业务发生日期对应的任职关系判断；“查看人员详情”则按人员当前有效组织范围另行判断，因此一条历史行可见时，详情入口仍可能禁用。
- 当前人员按唯一的当前有效部门任职判断组织范围；历史业务记录按业务发生日期对应的有效部门任职判断组织范围。

## 四、菜单、路由与 API 状态

除登录外，下面 API 均位于 `/api/v1` 且需要 Bearer JWT。列表接口均为分页 GET；除人员新增/编辑外，本快照中的新业务列表未宣称具有写入能力。

### 4.1 人员信息、合同与职责转交

| 菜单/页面 | 前端路由 | 后端接口 | 当前状态 |
|---|---|---|---|
| 人员 | `/personnel/employees` | `GET /employees`、`GET /employees/regular`、`GET /employment/interns`、`GET /employment/personnel-labor-workers`、`GET /employment/personnel-resigned` | 已实现五张可切换卡片：全部在职复用原 46 列宽表，实习生复用任职管理表，正式/劳务/离职使用各自只读表格；筛选、分页和详情入口按各表口径执行。 |
| 人员详情/新增/编辑 | `/personnel/employees/:id`、`/new`、`/:id/edit` | `GET /employees/:id`、`GET /employees/form-options`、`POST /employees`、`PATCH /employees/:id` | 已有核心业务链路。 |
| 黑名单管理 | `/personnel/blacklist` | `GET /blacklist` | 已实现只读列表；符合条件时可查看关联人员。 |
| 黑名单移除页 | `/personnel/blacklist/removal` | 无独立移除接口 | 有前端路由，不应视为已完成移除流程。 |
| 员工信息审批 | `/personnel/approval` | `GET /employee-info-approval` | 已实现只读列表和两个页签。 |
| 合同协议 | `/contracts` | `GET /contracts` | 已实现当前有效合同只读列表；操作禁用。 |
| 职责转交 | `/handover` | 无 | 独立前端静态页面；接收人选项和设置按钮尚未连接业务接口。 |

### 4.2 录用入职

| 页面 | 前端路由 | 后端接口 | 当前状态 |
|---|---|---|---|
| Offer 管理 | `/onboarding/offers`、`/onboarding/offers/templates`、`/onboarding/offers/new` | `GET /onboarding/offers`、`GET /onboarding/intern-offer-form-options`、`GET /onboarding/intern-conversion-options`、`GET /onboarding/intern-conversion-options/:employeeId`、`POST /onboarding/intern-offers` | 已实现六张状态卡及 Offer 直接创建：新增人员与实习生转正均创建 Candidate + Offer 快照；创建入口页不保存模板、版本或配置。 |
| 入职管理 | `/onboarding/entries` | `GET /onboarding/entries` | 已实现只读列表。 |
| 新员工融入 | `/onboarding/integration` | `GET /onboarding/integration` | 已实现只读列表。 |
| 新员工入职介绍 | `/onboarding/introduction` | `GET /onboarding/introduction` | 已实现只读列表。 |
| 读取身份证 | `/onboarding/id-card-reader` | `GET /onboarding/id-card-reader` | 已实现只读列表。 |

五个页面的“操作”均显示禁用的“暂无操作”，当前没有对应维护或详情 API。

### 4.3 任职管理

| 页面 | 前端路由 | 后端接口 | 当前状态/口径 |
|---|---|---|---|
| 试用管理 | `/employment/probation` | `GET /employment/probation` | 已实现业务记录列表及分组视图。 |
| 异动管理 | `/employment/changes` | `GET /employment/movements` | 已实现异动记录及进行中/已完成/全部视图。 |
| 试岗期管理 | `/employment/trial-post` | `GET /employment/trial-posts` | 已实现试岗记录列表。 |
| 实习生管理 | `/employment/interns` | `GET /employment/interns` | 已实现当前有效实习任职周期。 |
| 劳务人员管理 | `/employment/labor` | `GET /employment/labor-workers` | 已实现当前有效劳务人员任职周期。 |
| 离职管理 | `/employment/termination` | `GET /employment/terminations` | 已实现离职业务记录及进行中/已完成/全部视图。 |
| 退休管理 | `/employment/retirement` | `GET /employment/retirements` | 已实现退休业务记录列表。 |
| 兼职管理 | `/employment/part-time` | `GET /employment/part-time` | 已实现当前有效兼职任职关系。 |
| 任职记录 | `/employment/records` | `GET /employment/records` | 已实现当前/历史两种口径。 |
| 汇报关系 | `/employment/reporting-lines` | 无列表接口 | 待确认字段的占位页；必须保留“汇报关系”和“汇报关系图”两个页签。 |

九个已实现页面的操作列均按 `employeeId + canViewEmployeeDetail` 决定是否显示“查看”；不符合当前详情范围时禁用并显示“暂无详情”。

### 4.4 人员子集

| 页面 | 前端路由 | 后端接口 | 当前状态 |
|---|---|---|---|
| 教育经历 | `/subsets/education` | `GET /subsets/education` | 已实现。 |
| 工作履历 | `/subsets/work-history` | `GET /subsets/work-history` | 已实现。 |
| 家庭成员 | `/subsets/family` | `GET /subsets/family` | 已实现。 |
| 考核结果 | `/subsets/appraisals` | `GET /subsets/appraisals` | 已实现。 |
| 培训经历 | `/subsets/training` | `GET /subsets/training` | 已实现。 |
| 表彰与奖励 | `/subsets/awards` | `GET /subsets/awards` | 已实现。 |
| 证书执照 | `/subsets/certificates` | `GET /subsets/certificates` | 已实现。 |
| 项目经历 | `/subsets/projects` | `GET /subsets/projects` | 已实现。 |
| 专业技能 | `/subsets/skills` | `GET /subsets/skills` | 已实现。 |
| 语言能力 | `/subsets/languages` | `GET /subsets/languages` | 已实现。 |
| 材料管理 | `/subsets/materials` | 无 | 占位页；保留“按人员查看/按分类查看/全部材料”页签。 |

十个已实现子集页的操作列按当前人员详情范围显示“查看”或禁用的“暂无详情”。

### 4.5 编制管理与数据分析

| 页面 | 前端路由 | 后端接口 | 当前状态 |
|---|---|---|---|
| 调动类型 | `/staffing/transfer-types` | `GET /staffing/transfer-types` | 已实现只读列表；有表格勾选 UI，但没有批量或维护接口，操作禁用。 |
| 员工名册 | `/analytics/roster` | `GET /analytics/roster` | 已实现当前在职员工组合宽表。 |
| 人事看板 | `/analytics/dashboard` | 无 | 占位页。 |
| 员工结构 | `/analytics/structure` | 无 | 占位页。 |
| 流动情况 | `/analytics/mobility` | 无 | 占位页。 |
| 合同情况 | `/analytics/contracts` | 无 | 占位页。 |
| 报表设计 | `/analytics/reports` | 无 | 占位页。 |
| 设置 | `/settings` | 无 | 占位页。 |

## 五、页面字段来源说明

以下表格中的“固定 `null/--`”表示当前模型或业务语义没有可靠来源：API 明确返回 `null`，前端保留列并显示 `--`。

### 5.1 人员列表

接口：`GET /employees`。页面是一行一人的当前宽表，组合员工主档案、当前任职周期、当前任职关系、当前有效合同协议关联的全日制公司目录、固定人员定位/员工层级、主要经理、主要证件、紧急联系人和最高学历；人员来源优先取当前主要任职，其次取当前任职周期，不以候选人来源替代。

| 页面列 | shared/API 字段 | Prisma/业务来源与当前口径 |
|---|---|---|
| 工号、姓名 | `employeeNo`、`name` | `Employee.employeeNo`、`Employee.name`。姓名链接人员详情。 |
| 部门 | `organizationName` | 当前主要 `EmployeeAssignment.organization.name`；迁移兼容时可回退 `Employee.organization`。 |
| 入职日期 | `entryDate` | 当前 `EmploymentPeriod.entryDate`。 |
| 职位、职级、工作地点 | `positionName`、`jobLevel`、`workplaceName` | 当前主要任职关联的 `Position`、固定 `JobLevelCode` code、`Workplace`；职位目录当前以用户提供的 434 条五位编号/名称为唯一标准，选择时显示“编号 - 名称”并支持两个维度搜索，部门与职位独立；职级允许 `S1`–`S7`、`E1`–`E7`、`T1`–`T7`、`M1`–`M7`。 |
| 性别 | `gender` | `Employee.gender`。 |
| 人员定位、员工层级 | `personnelPosition`、`employeeLevel` | 当前主要 `EmployeeAssignment.personnelPosition`、`EmployeeAssignment.employeeLevel` 固定 enum code；API 返回 code，前端映射中文标签。无当前值时返回 `null/--`。 |
| 企业邮箱 | `workEmail` | `Employee.workEmail`。 |
| 个人邮箱 | `personalEmail` | `Employee.personalEmail`。 |
| 手机号码 | `mobile` | `Employee.mobile`，由后端按现有接口行为返回。 |
| 人员类别 | `personnelCategory` | 当前主要 `EmployeeAssignment.personnelCategory`，无任职时返回 `null`。 |
| 人员来源 | `personnelSource` | 当前主要 `EmployeeAssignment.personnelSource`，无值时回退当前 `EmploymentPeriod.personnelSource`；`Candidate.source` 不作为人员列表人员来源的替代字段。 |
| 人员状态 | `employmentStatus` | 当前 `EmploymentRecord.status`。 |
| 全日制公司 | `fullTimeCompany` | 当前任职周期中当前有效 `EmployeeAgreement.employingCompany.name`；无可确认协议或目录记录时返回 `null/--`。 |
| 雇佣关系 | `employmentRelationship` | 当前主要 `EmployeeAssignment.employmentRelationship`，无任职时回退当前 `EmploymentPeriod.employmentRelationship`。 |
| 用工形式 | `workArrangement` | 当前主要 `EmployeeAssignment.workArrangement`。 |
| 直线经理 | `managerName` | 当前主要 `ReportingRelationship.manager.name`。 |
| 直线经理邮箱 | `managerEmail` | 当前主要经理的 `Employee.workEmail`。 |
| 累计工龄（年） | `totalWorkYears` | 对 `EmployeeWorkExperience` 的起止日期逐段计算并求和。 |
| 累计司龄（年） | `totalServiceYears` | 对该员工全部 `EmploymentPeriod.entryDate/actualExitDate` 逐段计算并求和。 |
| 证件类型、证件号码、证件截止日期 | `documentType`、`documentNumber`、`documentExpiryDate` | 主要 `EmployeeIdentityDocument`，无主要项时取第一条。 |
| 出生日期、年龄 | `birthDate`、`age` | `Employee.birthDate`；年龄按查询时日期计算。 |
| 民族、婚姻状况、政治面貌、籍贯详细说明 | `ethnicity`、`maritalStatus`、`politicalStatus`、`nativePlace` | `Employee` 同名业务字段；既有籍贯自由文本保持原样。 |
| 籍贯地区、户籍所在地地区、联系地址地区 | `nativePlaceRegionCode`、`householdRegionCode`、`residentialRegionCode` | `Employee` 的 GB/T 2260 兼容行政区划代码。人员编辑页使用共享 `china-division` 三层静态目录级联选择；后端校验代码存在，未填为 `null`，不从既有文本猜测或回填。 |
| 户口类别 | `householdType` | `Employee.householdType`；尚未录入时返回 `null/--`。 |
| 户籍详细地址、联系详细地址 | `householdAddress`、`residentialAddress` | `Employee.householdAddress`、`Employee.residentialAddress`；历史自由文本保持原样。 |
| 紧急联系人、与本人关系、紧急联系人电话 | `emergencyContactName`、`emergencyContactRelationship`、`emergencyContactMobile` | 标记为紧急联系人的 `EmployeeFamilyMember`。 |
| 银行、开户行支行、银行账号 | `bankName`、`bankBranchName`、`bankAccountNumber` | 分别取 `Employee.bankName`、`Employee.bankBranchName`、`Employee.bankAccountNumber`；未录入时返回 `null/--`。银行名称当前仅实现 Prisma 已确认的 `ICBC`。 |
| 毕业学校名称、最高学历、毕业时间、专业 | `graduationSchoolName`、`highestEducation`、`graduationDate`、`major` | 最高学历 `EmployeeEducationExperience`，无明确最高项时取第一条。 |
| 院校类型 | `institutionType` | 当前最高教育记录的 `EmployeeEducationExperience.institutionType`；没有有效教育记录或未录入时返回 `null/--`。 |
| 操作 | — | 始终提供人员详情“查看”；页面另按创建权限显示“新增人员”。 |

#### 人员页五张切换表格

人员页的五张可点击卡片通过 URL `view=all|regular|intern|labor|resigned` 切换，并在切换时重置页码、清理其他视图不适用的筛选参数。卡片数字是各自分页接口当前范围内的 `meta.total`，不另行制造跨视图统计口径。

| 卡片 | 接口/复用 | 列与口径 |
|---|---|---|
| 全部在职 | `GET /employees` | 复用原 46 列业务宽表和操作列；不新建重复查询。 |
| 正式人员 | `GET /employees/regular` | 当前内部正式人员，即 `INTERNAL_EMPLOYEE + REGULAR`；列顺序为姓名、工号、入职日期、部门、职位、职级、性别、企业邮箱、用工形式、直线经理、简历信息、面试评价、银行、银行账号、开户行支行、全日制公司、操作。简历信息和面试评价固定 `null/--`。 |
| 实习生 | `GET /employment/interns` | 直接复用任职管理实习生管理列表字段、筛选、分页和详情入口，不复制 API 或列配置。 |
| 劳务人员 | `GET /employment/personnel-labor-workers` | 当前有效主要任职对应的劳务人员；列为姓名、电子邮箱、工号、入职日期、部门、职务、职位、用工形式、直线经理、操作。不返回工作地点或全日制公司。 |
| 离职人员 | `GET /employment/personnel-resigned` | 未归档且已完成离职记录；列为工号、姓名、部门、性别、入职日期、离职前职位、离职原因、异动类型、最后工作日、全日制公司、证件号码、手机号码。异动类型固定 `null/--`，无操作列；历史范围按离职日和同周期主要任职授权。 |

全部在职沿用现有部门/人员状态/人员选择筛选；正式人员支持姓名/工号与组织子树筛选；实习生、劳务人员和离职人员分别复用其起始日期、入职日期、最后工作日的日期范围筛选。行勾选仅为前端页面状态。

### 5.2 黑名单管理

接口：`GET /blacklist`，主记录为 `EmployeeBlacklistRecord`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名 | `name` | `EmployeeBlacklistRecord.name`。 |
| 证件号码 | `documentNumber` | `EmployeeBlacklistRecord.documentNumber`。 |
| 手机号 | `mobile` | `EmployeeBlacklistRecord.mobile`。 |
| 加黑原因 | `reason` | `EmployeeBlacklistRecord.reason`。 |
| 加黑日期 | `effectiveDate` | `EmployeeBlacklistRecord.effectiveDate`。 |
| 有效截止日期 | `expiryDate` | `EmployeeBlacklistRecord.expiryDate`。 |
| 邮箱 | `workEmail` | 关联人员的 `Employee.workEmail`，未关联人员时为 `null/--`。 |
| 操作 | — | 有 `employeeId` 且允许查看时进入人员详情，否则禁用。 |

### 5.3 员工信息审批

接口：`GET /employee-info-approval`，主记录为 `EmployeeChangeRequest`，关联 `ApprovalRequest` 和审批步骤。页面保留“在职信息采集/个人信息变更”页签。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 人员 | `employeeName` | `Employee.name`。 |
| 部门 | `departmentName` | 人员当前可见任职的组织；无任职时仅在兼容条件下回退旧 `Employee.organization`。 |
| 信息采集活动名称 | `activityName` | 固定 `null/--`。 |
| 发起人 | `applicantName` | `ApprovalRequest.applicant.displayName`。 |
| 发起时间 | `submittedAt` | `ApprovalRequest.submittedAt`。 |
| 信息采集状态 | `status` | 优先 `ApprovalRequest.status`，否则使用变更请求状态。 |
| 当前审批人 | `currentApproverName` | 当前待处理 `ApprovalStep.approver.displayName`。 |
| 操作 | — | 符合条件时查看人员详情。 |

### 5.4 录用入职

#### Offer 管理

接口：`GET /onboarding/offers`。页面通过六张同级、可点击的状态卡在同一路由内切换一张分页表格；URL `view` 为 `PENDING_SEND`（默认）、`SENT`、`ACCEPTED`、`REJECTED`、`ONBOARDED` 或 `ALL`，响应 `meta.viewCounts` 返回同一账号组织范围内的六个实时数量。卡片分组按优先级互斥：实际入职优先，其次已拒绝、已接受、已发，剩余未归档记录为待发；全部 Offer 包含所有未归档记录。

| 页面列/字段组 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、个人邮箱、手机号码 | `name`、`personalEmail`、`mobile` | `Candidate.name/email/mobile`。 |
| 性别 | `gender` | 关联已接受员工或入职单员工的 `Employee.gender`；候选人无性别来源时为 `null/--`。 |
| 录用部门/部门 | `organizationName` | `Offer.organization.name`，不以员工入职后的当前部门替代。 |
| 应聘职位 | `appliedPositionName` | 当前没有已确认的外部职位字段，固定 `null/--`。 |
| 录用职位 | `offeredPositionName` | 公司内部 `Offer.position.name`。 |
| 工作地点、拟入职日期、试用期（月） | `workplaceName`、`proposedEntryDate`、`probationMonths` | `Offer.workplace.name`、`Offer.proposedEntryDate`、`Offer.probationMonths`。 |
| Offer 发送日期、接受 Offer 日期、拒绝原因备注 | `issueDate`、`acceptedAt`、`rejectedReason` | 对应 `Offer.issueDate/acceptedAt/rejectedReason`。 |
| 拒绝 Offer 日期 | `rejectedAt` | 当前模型没有拒绝日期，固定 `null/--`；不得使用创建或更新时间替代。 |
| 已入职 Offer 入职日期、邮箱 | `entryDate`、`personalEmail` | `Offer.onboardingCase.actualEntryDate`、`Candidate.email`；用户确认该页面的“邮箱”也展示个人邮箱。 |
| Offer 状态 | `offerStatus` | `Offer.status`，前端显示通用流程状态中文标签，独立于审批状态。 |
| 审批状态、当前审批人、Offer 发送人、推荐人、同步状态 | 对应 shared 字段 | Offer 当前没有可靠的审批、发送人、推荐人或同步记录关系，固定 `null/--`。 |
| 简历信息 | `resumeInfo` | 候选人简历附件存在且有效时返回 `AVAILABLE` 标记，不返回附件内容或 ID。 |
| 操作 | — | 已发、已接受、已拒绝、已入职和全部 Offer 均禁用“暂无操作”；待发 Offer 提供首版“新建实习 Offer”草稿入口。 |

#### Offer 直接创建

- Offer 管理待发视图同时提供“新建实习Offer”直接入口和“创建Offer”路径选择入口。`/onboarding/offers/templates` 仅是创建路径选择页，保留历史 URL 以便路由稳定；它不再读取、保存或显示持久化 Offer 模板、版本、配置、审批按钮或工时制度。
- **新增人员**进入 `/onboarding/offers/new?source=new-hire`，以空白直接表单创建 Offer。**实习生转正**先选择当前权限范围内有效的 `INTERN` 员工，调用 `GET /onboarding/intern-conversion-options/:employeeId` 获取只读预填，再进入同一直接表单；预填的所有字段都可编辑。
- 预填只查询当前、在范围内、未离职的实习员工主档、主要有效证件、最高有效学历、当前周期主要任职/有效协议，以及当前主要行政汇报关系。无可靠来源返回 `null`，不借用近似值；直线经理只有主要 `ADMINISTRATIVE` 当前关系时才返回。预填不创建任何记录。
- 接口：`GET /onboarding/intern-offer-form-options`、`GET /onboarding/intern-conversion-options`、`GET /onboarding/intern-conversion-options/:employeeId`、`POST /onboarding/intern-offers`，均需 `employee.create`，仅支持 PostgreSQL；Demo 模式统一返回 `409`“新建实习Offer仅支持数据库模式”。
- 直接创建保存 Candidate、可选候选人证件/教育快照、Offer 及可选薪资/兼职快照。`Candidate.source` 是唯一保存的人员来源；不保存新增/转正创建路径 enum。Offer 固定 `INTERN + DRAFT + issueDate=null`，不会创建员工、任职周期/关系、汇报关系、合同、入职单或审批记录。
- 录用部门和职位必填并验证有效性及组织范围；工作地点为可选，提供时才验证有效性，未选保存 `null`、办公地址显示 `--`。职位和部门仍是独立维度。审批流程尚待确认，当前没有预览审批人或提交审批。


#### 入职管理

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、性别 | `name`、`gender` | `OnboardingCase.employee` 的 `Employee.name/gender`。 |
| 待入职部门、计划入职地点、职位 | `plannedOrganizationName`、`plannedWorkplaceName`、`positionName` | 关联 `Offer` 的组织、地点和职位。 |
| 计划入职日期 | `plannedEntryDate` | `OnboardingCase.plannedEntryDate`。 |
| 直线经理 | `managerName` | 员工当前主要汇报关系。 |
| 入职状态 | `onboardingStatus` | `OnboardingCase.status`。 |
| 全日制公司、合同类型、生效日期、终止日期 | `fullTimeCompany`、`contractType`、`effectiveDate`、`terminationDate` | 当前任职周期恰好匹配一份当前有效 `EmployeeAgreement` 时读取其 `employingCompany.name`、协议类型和日期；不能唯一确认时显示 `--`。 |
| 数据来源 | `dataSource` | `Offer.candidate.source`。 |
| 入职类型、职级、入职准备状态、信息采集状态、入职材料状态、雇佣关系、当前审批人 | 对应 shared 字段 | 固定 `null/--`。 |
| 操作 | — | 禁用。 |

#### 新员工融入

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 人员 | `employeeName` | `OnboardingIntegrationRecord.employee.name`。 |
| 部门、职务 | `organizationName`、`jobTitleName` | 当前主要任职的组织和 `JobTitle`。 |
| 入职日期 | `entryDate` | 当前 `EmploymentPeriod.entryDate`。 |
| 直线经理 | `managerName` | 当前主要汇报关系。 |
| 融入状态 | `integrationStatus` | `OnboardingIntegrationRecord.status`。 |
| 融入进度 | `integrationProgress` | 固定 `null/--`。 |
| 操作 | — | 禁用。 |

#### 新员工入职介绍

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、性别 | `name`、`gender` | `Employee.name/gender`。 |
| 部门、职位 | `organizationName`、`positionName` | 当前主要任职的组织和职位。 |
| 入职日期 | `entryDate` | 当前任职周期入职日期。 |
| 入职介绍信息状态 | `introductionStatus` | `EmployeeIntroduction.status`。 |
| 操作 | — | 禁用。 |

#### 读取身份证

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、性别、民族、出生日期、户籍所在地 | 对应 shared 字段 | 关联 `Employee` 主档案。 |
| 证件类型、证件号码、签发机关、证件开始日期、证件截止日期 | 对应 shared 字段 | 当前有效的 `EmployeeIdentityDocument`（身份证类型）。 |
| 最后工作日、离职前部门、离职类型、离职原因 | 对应 shared 字段 | 取最近的有效 `TerminationRecord`，部门按离职业务日期对应的主要任职解析。 |
| 照片、录入人 | `photo`、`recordedBy` | 固定 `null/--`。 |
| 录入时间 | `recordedAt` | 证件记录 `createdAt`，表示当前证件记录的录入时间。 |
| 操作 | — | 禁用。 |

### 5.5 任职管理

#### 试用管理

主记录：`ProbationRecord`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 工号、姓名 | `employeeNo`、`employeeName` | 关联 `Employee`。 |
| 部门、职位 | `departmentName`、`positionName` | 同一任职周期中，在试用开始日期有效的任职关系。 |
| 试用开始日期、预计试用结束日期 | `startDate`、`plannedEndDate` | `ProbationRecord.startDate/plannedEndDate`。 |
| 操作 | — | 按当前详情范围查看人员。 |

#### 异动管理

主记录：`EmployeeMovement`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、工号 | `employeeName`、`employeeNo` | 关联 `Employee`。 |
| 异动日期 | `effectiveDate` | `EmployeeMovement.effectiveDate`。 |
| 异动类型 | `movementTypeName` | `MovementType.name`。 |
| 异动类型（员工端） | `movementTypeEmployeeName` | 固定 `null/--`。 |
| 审批状态 | `approvalStatus` | 已关联且未归档的 `ApprovalRequest.status`。异动自身流程状态另由 `movementStatus` 保留。 |
| 调动前部门/职位/职级 | `fromDepartmentName`、`fromPositionName`、`fromJobLevel` | `EmployeeMovement` 的 from 组织、职位关系及固定 `JobLevelCode` code。 |
| 调动后部门/职位/职级 | `toDepartmentName`、`toPositionName`、`toJobLevel` | `EmployeeMovement` 的 to 组织、职位关系及固定 `JobLevelCode` code。 |
| 调动后工作地点、交接状态、试岗结束日期 | `toWorkplaceName`、`handoverStatus`、`trialPostEndDate` | 固定 `null/--`。 |
| 当前审批人 | `currentApproverName` | 当前待处理审批步骤的人员名称；无可确认步骤时为 `--`。 |
| 操作 | — | 按当前详情范围查看人员。 |

#### 试岗期管理

主记录：`TrialPostRecord`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、工号 | `employeeName`、`employeeNo` | 关联 `Employee`。 |
| 试岗开始日期、试岗结束日期 | `startDate`、`endDate` | `TrialPostRecord.startDate/endDate`。 |
| 调动类型 | `movementTypeName` | 固定 `null/--`，当前试岗记录没有已确认的调动类型关系。 |
| 试岗部门 | `departmentName` | `TrialPostRecord.targetPosition.organization.name`。 |
| 试岗职务 | `jobTitleName` | 固定 `null/--`。 |
| 考核结果 | `result` | `TrialPostRecord.result`。 |
| 试岗状态 | `status` | `TrialPostRecord.status`。 |
| 操作 | — | 按当前详情范围查看人员。 |

#### 实习生管理

主记录：当前有效且 `employmentRelationship=INTERN` 的 `EmploymentPeriod`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名 | `employeeName` | `Employee.name`。 |
| 邮箱 | `workEmail` | `Employee.workEmail`。 |
| 实习机构 | `internshipOrganizationName` | 固定 `null/--`。 |
| 实习部门、实习职位 | `departmentName`、`positionName` | 当前有效任职的组织和职位。 |
| 实习开始日期 | `startDate` | `EmploymentPeriod.entryDate`。 |
| 审批状态、直线经理、银行、银行账号、开户行支行 | 对应 shared 字段 | 固定 `null/--`。 |
| 操作 | — | 按当前详情范围查看人员。 |

#### 劳务人员管理

主记录：当前有效且 `employmentRelationship=LABOR_WORKER` 的 `EmploymentPeriod`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、电子邮箱、工号 | `employeeName`、`workEmail`、`employeeNo` | `Employee.name/workEmail/employeeNo`。 |
| 入职日期 | `entryDate` | `EmploymentPeriod.entryDate`。 |
| 部门、职务、工作地点 | `departmentName`、`jobTitleName`、`workplaceName` | 当前有效任职关联的组织、职务和地点。 |
| 用工形式 | `workArrangement` | 当前有效主要 `EmployeeAssignment.workArrangement`，显示六项已确认用工形式。 |
| 直线经理 | `managerName` | 当前有效汇报关系中的主要/优先经理。 |
| 操作 | — | 按当前详情范围查看人员。 |

#### 离职管理

主记录：`TerminationRecord`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 工号、姓名 | `employeeNo`、`employeeName` | 关联 `Employee`。 |
| 离职前部门、离职前职位 | `previousDepartmentName`、`previousPositionName` | 同一任职周期中，在最后工作日有效的主要任职。 |
| 最后工作日 | `lastWorkingDate` | 优先 `actualLastWorkingDate`，否则 `plannedLastWorkingDate`；`lastWorkingDateBasis` 保留实际/计划口径。 |
| 离职类型、离职原因 | `terminationType`、`terminationReason` | `TerminationRecord.terminationType/reason`。 |
| 审批状态、当前审批人 | `approvalStatus`、`currentApproverName` | 未归档 `ApprovalRequest` 及其当前待处理步骤。 |
| 离职交接状态 | `handoverStatus` | 未归档 `HandoverCase.status`。 |
| 离职补偿金 | `compensationAmount` | 固定 `null/--`。 |
| 操作 | — | 按当前详情范围查看人员。 |

#### 退休管理

主记录：`RetirementRecord`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、工号、性别、出生日期 | 对应 shared 字段 | 关联 `Employee`。 |
| 年龄 | `age` | 根据出生日期和查询时日期计算。 |
| 预计退休日期 | `plannedRetirementDate` | `RetirementRecord.plannedRetirementDate`。 |
| 部门、职务 | `departmentName`、`jobTitleName` | 同一任职周期中，在实际/预计退休日期有效的主要任职。 |
| 操作 | — | 按当前详情范围查看人员。 |

#### 兼职管理

主记录：当前有效且 `workArrangement=PART_TIME` 的 `EmployeeAssignment`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 姓名、工号 | `employeeName`、`employeeNo` | 关联 `Employee`。 |
| 兼职类型、兼职机构、兼职直线经理 | `partTimeType`、`institutionName`、`managerName` | 固定 `null/--`。 |
| 兼职开始日期、兼职结束日期 | `startDate`、`endDate` | `EmployeeAssignment.startDate/endDate`。 |
| 兼职部门、兼职职务 | `departmentName`、`jobTitleName` | 任职关联的 `Organization` 和 `JobTitle`。 |
| 任职状态 | `assignmentStatus` | `EmployeeAssignment.status`。 |
| 审批状态 | `approvalStatus` | 固定 `null/--`。 |
| 操作 | — | 按当前详情范围查看人员。 |

关键词输入使用独立草稿状态并与 URL 查询参数同步，按 Enter/搜索后更新查询，不会因每次输入字符立即请求。

#### 任职记录

主记录：`EmployeeAssignment`；一条可见任职关系对应一行。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 工号、姓名 | `employeeNo`、`employeeName` | 关联 `Employee`。 |
| 入职日期 | `entryDate` | 关联 `EmploymentPeriod.entryDate`。 |
| 任职部门、任职职位 | `departmentName`、`positionName` | 任职关联的组织和职位。 |
| 现岗位开始日期、现岗位结束日期 | `positionStartDate`、`positionEndDate` | `EmployeeAssignment.startDate/endDate`。 |
| 人员定位 | `personnelLocator` | 固定 `null/--`。 |
| 人员状态 | `personnelStatus` | 同一任职周期内在任职开始日期有效的 `EmploymentRecord.status`；兼容无周期旧记录。 |
| 任职状态 | `assignmentStatus` | `EmployeeAssignment.status`。 |
| 审批状态、面试评价 | `approvalStatus`、`interviewEvaluation` | 固定 `null/--`。 |
| 是否最新主职记录 | `isLatestPrimaryRecord` | 在授权查询全集内，按员工和任职周期计算最新主要任职，不只在当前分页内计算。 |
| 简历信息 | `availability` | 转换候选人存在简历附件时返回 `AVAILABLE` 标记，不返回附件内容或 ID。 |
| 操作 | — | 按当前详情范围查看人员。 |

### 5.6 合同协议

接口：`GET /contracts`，主记录为当前有效且未终止的 `EmployeeAgreement`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 工号、姓名 | `employeeNo`、`employeeName` | `Employee.employeeNo/name`。 |
| 部门 | `departmentName` | 协议所属任职周期的当前主要任职组织。 |
| 入职日期 | `entryDate` | 协议所属 `EmploymentPeriod.entryDate`。 |
| 全日制公司 | `fullTimeCompany` | `EmployeeAgreement.employingCompany.name`；公司只关联合同协议并保留协议历史，不写入员工任职。 |
| 合同类型 | `agreementType` | `EmployeeAgreement.agreementType`。 |
| 期限类型 | `termType` | 有 `endDate` 为 `FIXED`，否则为 `OPEN_ENDED`。 |
| 生效日期、终止日期 | `effectiveDate`、`endDate` | `EmployeeAgreement.startDate/endDate`。 |
| 最新电子协议签署状态、最新电子协议附件、电子协议签署记录、合同备注 | 对应 shared 字段 | 固定 `null/--`。 |
| 操作 | — | 禁用“暂无操作”。 |

页面有表格勾选 UI，但当前没有批量业务接口。

### 5.7 人员子集

十个子集列表共有以下人员上下文字段：

| 页面列 | shared/API 字段 | 通用来源与行为 |
|---|---|---|
| 姓名、工号 | `employeeName`、`employeeNo` | 关联 `Employee.name/employeeNo`。 |
| 邮箱 | `workEmail` | `Employee.workEmail`。 |
| 部门/当前任职部门 | `departmentName` | 当前有效主要 `EmployeeAssignment.organization.name`。 |
| 操作 | — | 按当前详情范围显示“查看”或禁用“暂无详情”。 |

各子集业务字段：

| 页面 | 真实来源字段 | 固定 `null/--` 字段 |
|---|---|---|
| 教育经历 | `EmployeeEducationExperience.startDate/endDate/schoolName/major/educationLevel/degree/isHighestEducation` | 毕业学校类型 `schoolType`。 |
| 工作履历 | `EmployeeWorkExperience.companyName/startDate/endDate/referenceName`；页面“职务”当前取人员当前任职的 `JobTitle.name` | 审批状态。 |
| 家庭成员 | `EmployeeFamilyMember.name/relationship/gender/mobile` | 审批状态。 |
| 考核结果 | `EmployeeAppraisal.appraisalPeriod/appraisalType/score`；考核年度从周期文字中的四位年份解析 | 考核部门、起始日期、截止日期。 |
| 培训经历 | `EmployeeTrainingRecord.startDate/endDate/trainingName/trainingProvider/result` | 审批状态、获得学分。 |
| 表彰与奖励 | `EmployeeAward.awardDate/awardName/reason` | 审批状态。 |
| 证书执照 | `EmployeeCertificate.certificateName/certificateNo/issuingAuthority/issueDate/expiryDate` | 审批状态。 |
| 项目经历 | `EmployeeProjectExperience.startDate/endDate/projectName/projectRole/projectDescription` | 审批状态。 |
| 专业技能 | `EmployeeSkill.skillName/proficiencyLevel/skillCategory` | 审批状态。 |
| 语言能力 | `EmployeeLanguageAbility.language/writingLevel/readingLevel/speakingLevel` | 是否母语、综合掌握程度、审批状态。 |

所有子集接口仅查询有效、未归档的业务记录和有效人员；组织筛选按选中组织及其下级处理。

### 5.8 员工名册

接口：`GET /analytics/roster`。一行对应一个当前在职员工，使用当前有效任职周期和当前主要任职，避免多部门重复计数。

| 字段组/页面列 | shared/API 字段 | 来源与当前口径 |
|---|---|---|
| 姓名、邮箱、工号、性别、出生日期、手机、个人邮箱、籍贯、户籍所在地、民族、婚姻状况、政治面貌 | 对应 shared 字段 | `Employee` 主档案；“邮箱”为 `workEmail`。民族、婚姻状况和政治面貌在前端按对应枚举中文标签显示。 |
| 年龄 | `age` | 出生日期按当前日期计算。 |
| 最高学历、毕业学校名称、毕业时间、专业 | `highestEducation`、`graduationSchoolName`、`graduationDate`、`major` | 有效教育经历中优先最高学历，其次按毕业日期选择；最高学历按 `EducationLevel` 中文标签显示。 |
| 证件号码 | `documentNumber` | 有效证件中优先主要证件。 |
| 紧急联系人、与本人关系、紧急联系人电话 | 对应 shared 字段 | 有效且标记为紧急联系人的家庭成员。 |
| 入职日期 | `entryDate` | 当前 `EmploymentPeriod.entryDate`。 |
| 开始日期、结束日期、部门、职务、职位、职级、工作地点 | 对应 shared 字段 | 当前主要 `EmployeeAssignment` 及其组织、`JobTitle`、`Position`、固定 `JobLevelCode`、`Workplace`。 |
| 直线经理、直线经理邮箱 | `managerName`、`managerEmail` | 当前主要行政汇报关系及经理 `workEmail`。 |
| 累计司龄（年） | `serviceYears` | 当前实现按当前任职周期 `entryDate` 到今天计算；不是所有再入职周期合计。 |
| 雇佣关系 | `employmentRelationship` | 当前主要 `EmployeeAssignment.employmentRelationship`，无值时回退当前 `EmploymentPeriod.employmentRelationship`，显示内部员工/实习生/劳务人员。 |
| 用工形式 | `workArrangement` | 当前主要 `EmployeeAssignment.workArrangement`，显示六项已确认用工形式；人员字段 migration 会先将历史测试值 `FULL_TIME` 转为 `CONTRACT_EMPLOYMENT`，名册查询不接受迁移期兼容值。 |
| 人员状态 | `employmentStatus` | 当前 `EmploymentPeriod.employmentStatus`，取八项人员状态；当前在职名册只纳入 `PROBATION`、`REGULAR`、`NON_REGULAR`。 |
| 是否有试用期、试用开始日期、预计试用结束日期、试用期（月）、转正日期 | 对应 shared 字段 | 当前任职周期最近一条有效试用记录。 |
| 组织全称、一级组织、二级组织、三级组织 | 对应 shared 字段 | 根据当前任职组织沿 `Organization.parentId` 向上组合；层级不足时显示 `--`。 |
| 合同类型、全日制公司、合同期限类型、合同生效日期、合同终止日期、实际终止时间 | 对应 shared 字段 | 当前任职周期最近一份符合条件的当前有效协议及其 `EmployingCompany`；期限类型由 `endDate` 判断。 |
| 户口类别 | `householdType` | 当前名册查询尚未选择 `Employee.householdType`，固定 `null/--`；不能因人员列表有该来源而冒充名册已接入。 |
| 入党/团日期、参加工作日期、累计工龄（年）、最后工作日、合同期限（月） | `partyLeagueJoinDate`、`workStartDate`、`workYears`、`lastWorkingDate`、`contractMonths` | 当前模型或名册查询没有可靠来源，固定 `null/--`。 |
| 人员类别 | `personnelCategory` | 当前名册查询从主要 `EmployeeAssignment.personnelCategory` 读取，回退当前 `EmploymentPeriod.personnelCategory`；无值时为 `null/--`，前端按人员类别中文标签显示。 |

员工名册当前没有操作列。

### 5.9 编制管理：调动类型

接口：`GET /staffing/transfer-types`，主记录为 `MovementType`。

| 页面列 | shared/API 字段 | 来源与行为 |
|---|---|---|
| 调动类型 | `name` | `MovementType.name`。 |
| 显示顺序 | `displayOrder` | 当前 schema 无字段，固定 `null/--`；不使用 `code` 代替。 |
| 生效日期 | `effectiveDate` | 当前 schema 无字段，固定 `null/--`；不使用 `createdAt` 代替。 |
| 状态 | `status` | `MovementType.status`，映射为有效/停用/已归档/已取消。 |
| 操作 | — | 无维护或详情 API，禁用“暂无操作”。 |

后端只查询 `id/name/status`，按 `name`、`id` 稳定排序；页面当前保留勾选框，但没有批量动作。

## 六、组织范围与详情入口

- 后端根据组织树计算“授权组织 + 全部下级组织”，而不是只按单个部门 ID 匹配。
- 当前人员类列表通常要求员工存在唯一的当前有效部门任职；部门筛选继续展开组织子树。
- 历史业务列表按业务日期和对应任职周期验证组织归属，允许识别已经结束、停用或归档的历史任职。
- 历史记录的可见性不自动授予人员当前详情权限；API 使用 `canViewEmployeeDetail` 明确控制操作列。
- 当前人员、合同和名册按唯一的当前有效部门任职展示；员工不同时间的历史部门记录不得导致同一统计时点重复计数。

## 七、已确认的审批业务规则

- 员工信息修改是否进入审批及具体适用范围由 HR 确定。
- 审批支持多级流程；每个特定任务匹配特定流程。流程定义由 HR 导入、导出和修改，其中配置审批级数、审批节点、审批人及审批人变更。
- 申请在最终审批通过后才写入正式业务数据；流程最终结果不通过时，整个申请视为不通过。
- HR 可查看全部审批；部门负责人可查看本部门及全部下级组织的审批；实际参与过流程的人员可查看其参与的对应审批。
- 历史审批永久保留。具备最大权限的人员可以修改审批记录，但修改必须留下审计记录，不能无痕覆盖。
- 审批状态及退回、驳回、撤回等具体状态流转仍待用户确认。

## 八、已完成的关键修复

- 任职管理九个列表均已建立前端页面、shared 契约和后端只读接口。
- 兼职关键词输入草稿与 URL 查询参数同步，搜索触发逻辑已修复。
- 当前有效日期判断统一按日历日边界处理，减少日期时间分量导致的漏查。
- 任职记录“是否最新主职记录”改为在授权全集中计算，不依赖当前分页。
- 任职记录人员状态按任职开始日期解析对应任职周期状态历史。
- 历史试用、异动、离职和退休记录按业务日期授权；历史行可见性与当前详情权限已经分离。
- 调动类型已建立独立只读 API 和真实页面；缺失的显示顺序、生效日期保持 `null/--`。
- 前后端共享包声明曾因 `shared/dist` 滞后导致类型缺失，重新构建 shared 后生产源码类型检查通过。
- 已移除独立的 `employee.sensitive.read` 权限、后端字段掩码/隐藏分支和前端敏感权限提示；授权组织范围内的人员字段按真实值返回。
- 人员枚举已统一：性别仅为男、女、保密；人员类别、雇佣关系和用工形式分别使用独立字段；人员状态为八项且当前有效人员只包含试用、正式、非正式；任职状态为“任职中/任职结束”两项。
- 删除当前模型中的 `PersonnelType`、`personnel_type`、`OrganizationType` 和 `organization_type`；当前 schema、后端、前端与 shared 契约不再保留同义兼容字段。
- 新增枚举对齐 migration：旧状态先转换后收窄；旧 `FULL_TIME` 测试值按确认口径转换为 `CONTRACT_EMPLOYMENT` 后收窄为六项用工形式。`employees.id_card_no` 改为可空兼容字段，只有当前主要居民身份证才同步；该 migration 尚未连接或应用至任何数据库。
- 人员定位和员工层级已确认改为 `EmployeeAssignment` 上的固定 enum code，保留每条任职的历史值；后续纠正性 migration 会先从旧目录外键回填 code，遇到未知非空目录 code 明确阻断，再删除旧目录表与外键。该 migration 仅静态审查，尚未运行或连接数据库；全日制公司仍是独立目录。
- 职级已改为 `JobLevelCode` 固定 enum：`S1`–`S7`、`E1`–`E7`、`T1`–`T7`、`M1`–`M7`。当前/历史任职直接保存 `job_level` code，异动保存 `from_job_level`、`to_job_level` 快照；`20260828130000_convert_job_levels_to_fixed_enum` 会先校验旧目录关联及 code，再精确回填、删除旧外键/列/`job_levels` 表。该 migration 仅静态审查，尚未运行或连接数据库；新增职级下拉由 shared 固定数组提供，输入 `1` 可匹配四个系列的一级 code，PATCH 仍不支持直接修改职级。
- 人员编辑页部门选择已启用：`PATCH /employees/:id` 接受有权限的有效 `organizationId`，仅从对应任职周期的 `EmploymentPeriod.entryDate` 已不晚于当前业务日的有效主要任职中选择记录，以 UTC 业务日结束旧主要任职并复制任职快照创建新主要任职，同时同步兼容 `employees.organization_id` 并记录目录值变更日志；部门变更不自动修改职位。对于先前仅创建主档案而没有任职记录的人员，编辑页要求一次性补齐部门、入职日期、雇佣关系、用工形式、人员状态，保存时创建首段任职周期、主要任职和人员状态记录。人员 PATCH 已移除旧 `idCardNo` 输入，只接受规范证件字段。证件类型已按用户确认扩展为 60 项；仅居民身份证 `NATIONAL_ID` 同步迁移期兼容字段，任一其他证件类型均令其为 `null`。切换证件类型、仅改号码及仅改截止日期都会在同一事务中同步规范记录与兼容字段；完整证件记录缺失时必须一并给出类型和号码。旧泛化 `RESIDENCE_PERMIT` 在未来迁移中保守转换为 `OTHER`，不得猜测为港澳或台湾居民居住证。
- 人员字段变更日志已覆盖主档、单账户银行资料、当前紧急联系人、主要证件、最高教育以及当前任职字段；更新当前关联记录或按完整字段创建缺失的当前关联记录都会写日志。目录和已确认枚举字段记录稳定 code/ID 与修改当时中文标签快照。Demo 详情改为返回完整 `EmployeeDetail` 结构，不伪造 PostgreSQL 任职、银行、联系人或教育关系资料；仅将精简虚构主档已有的旧 `idCardNo` 兼容投影为 `NATIONAL_ID` 证件字段。
- 新增人员表单的银行账号正则已修正为 1–19 位数字校验；新增与编辑共用完整 `EmployeeDetail` 回填契约。

## 九、最近一次聚焦验证结果

以下是已经实际执行过的聚焦结果，不代表当前工作区所有文件的全量测试：

| 范围 | 结果 |
|---|---|
| 任职管理九页前端测试 | 9 个文件、34/34 测试通过。 |
| `employment.service` 后端测试 | 49/49 测试通过。 |
| 任职 presenters | 14/14 测试通过。 |
| 调动类型后端 service | 2/2 测试通过。 |
| 调动类型页面 | 3/3 测试通过。 |
| 前端路由套件 | 21/21 测试通过；与调动类型页面合计 24/24。 |
| shared typecheck | 通过。 |
| frontend typecheck | 通过。 |
| backend 生产源码 typecheck | 通过。 |
| shared build（含 ESM 产物） | 通过。 |
| Prisma schema 静态验证 | 通过（使用占位 `DATABASE_URL`，未连接数据库）。 |
| backend 全量 Jest | 20 个套件、204/204 测试通过。 |
| frontend 全量 Vitest | 34 个文件、128/128 测试通过。 |
| `git diff --check` | 通过（仅有 Windows LF/CRLF 转换警告）。 |
| 人员 service/presenter/demo 聚焦测试 | 3 个套件、22/22 测试通过。 |
| 人员表单/列表聚焦测试 | 2 个文件、5/5 测试通过。 |
| 人员字段收尾验证（shared build、前后端 typecheck、上述聚焦测试、`git diff --check`） | 通过；`git diff --check` 仅输出 Windows LF/CRLF 转换警告。 |
| Offer 直接创建后端 | 聚焦测试覆盖 Demo 409、目录/组织范围、无模板查询、直接新增与实习转正预填、可选工作地点、仅 Candidate + Offer 快照写入和编号重试。 |
| Offer 直接创建前端验证 | 直接表单、创建入口、Offer 页和路由聚焦 Vitest 通过；未启动应用或连接数据库。 |
| 职位目录替换与搜索 | 用户提供的 434 条职位编号/名称已固化为 shared 目录；shared build/typecheck、前后端 typecheck、人员/实习 Offer 职位表单 Vitest（10/10）、员工 service Jest（17/17）、Prisma 静态验证和 `git diff --check` 通过。测试目录替换脚本已新增但未执行、未连接数据库。 |
| 证件类型扩展 | 60 项用户确认的证件类型及统一中文标签已完成 shared/Prisma/前端接入；shared build/typecheck、frontend typecheck、人员/列表/身份证读取页 Vitest（18/18）、后端 employees 聚焦 Jest（25/25）、Prisma 静态验证和 `git diff --check` 通过。Prisma Client 重新生成被 Windows query engine 文件锁阻塞，尚未完成。 |
| 组织目录替换 | 用户确认的四层、44 节点组织树已固化为 shared 目录，根为上海宜信电子商务有限公司，负责人分组为 CEO陈锐/董事长陈钢；Demo、seed、组织范围和组织列表已同步，旧组织属于测试数据，替换脚本会直接删除。组织 service、AccessControl、DemoData、employees 聚焦后端测试 33/33，shared 目录断言、shared build/typecheck、backend/frontend typecheck（前端通过）及 `git diff --check` 已执行；组织替换脚本未执行、未连接数据库。 |
| 人员导入导出 | “全部在职”表格右上角已增加导入、导出按钮。导出弹窗可勾选字段并选择 XLSX/CSV；首列勾选人员时导出勾选项，未勾选时按当前关键词/部门/状态筛选导出全部有权人员。导入按中文业务表头读取 XLSX/CSV、以工号创建或局部更新并返回逐行结果；新工号可创建待完善主档，后续同工号导入同时提供部门、入职日期、雇佣关系、用工形式、人员状态时补建首段任职。职位/工作地点无法唯一匹配时作为提示而不猜测写入。完整新增页面仍维持必填任职/合同规则。后端 `POST /employees/export`、`POST /employees/import-template`、`POST /employees/import` 使用共享 `PERSONNEL_FIELDS` 注册表。 |

本次文档整理没有启动应用、连接 PostgreSQL、运行 migration/seed，也没有写入业务数据库。

## 十、已知限制与后续事项

1. 汇报关系页面字段和关系图规则尚未确认，目前是占位页，但“汇报关系/汇报关系图”页签不得删除。
2. 材料管理、其余数据分析页面和设置仍是占位实现。
3. 职责转交只有前端静态交互，没有后端 controller 或可用接收人数据，不是完整业务流程。
4. Offer 管理支持新增人员与实习生转正两条直接创建路径；其余录用入职页面、合同和调动类型目前均为只读列表，操作按钮禁用；不要在文档中推断不存在的维护能力。
5. 多个页面仍有明确的 `null/--` 字段，必须先确认模型和业务含义再新增字段或迁移，不能为填满列表使用近似值。
6. 枚举对齐 migration 仅做了静态审查和文件修改，尚未在真实 PostgreSQL 上执行或验证；实际执行前必须备份。旧 `FULL_TIME` 测试值将在人员字段 migration 中转换为 `CONTRACT_EMPLOYMENT` 后收窄，不进入 Prisma、shared 或应用 API。
7. PATCH 当前只支持“省略 = 保持不变”；显式 `null` 清空范围、空字符串规范化与 `expectedVersion` 并发控制尚未确定或实现，不能自行扩展清空语义。
8. 编辑仍不支持直接经理变更；经理关系循环校验、结束旧关系并新建历史关系，以及跨部门经理候选人在不泄露范围外人员资料前提下的展示方案仍待实现或确认。
9. [`docs/DATA_MODEL.md`](DATA_MODEL.md) 的“当前实现状态”表已经滞后，仍写着新模块 API 尚未实现、前端仍为占位；当前进展以本文和代码为准，后续如要同步该文档应单独处理。
10. 项目仅供 HR 使用，现有列表和详情不再设置独立的敏感字段读取权限或脱敏分支；人员字段仍受员工读取权限和组织数据范围约束。
11. 当前测试职位目录可通过 `npm run db:replace-position-catalog` 的显式确认变量替换：该脚本会删除当前测试数据中 Position 的已确认外键引用和旧职位记录，再导入 434 条用户提供的职位编号/名称；本快照不表示该脚本已经运行，执行前仍须确认目标为测试库。
12. 当前测试组织目录可通过 `npm run db:replace-organization-catalog` 的显式确认变量替换：设置 `CONFIRM_TEST_ORGANIZATION_CATALOG_RESET=REPLACE_44_TEST_ORGANIZATIONS` 后，脚本直接删除不在 44 节点目录中的旧测试组织，再恢复新目录；不应对包含正式历史数据的数据库运行。
13. 当前工作区包含大量尚未提交的增量功能，继续开发前必须先查看 `git status` 和相关 diff，不得覆盖或回退已有改动。
12. 当前工作区包含大量尚未提交的增量功能，继续开发前必须先查看 `git status` 和相关 diff，不得覆盖或回退已有改动。

## 十一、新对话接续建议

新对话开始时按以下顺序读取：

1. [`CLAUDE.md`](../CLAUDE.md)：项目目标、稳定业务规则、字段原则和开发约束。
2. 本文：当前路由、API、字段来源、测试和限制。
3. 用户指定页面的前端列配置、shared 契约、后端 controller/service/presenter。
4. [`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma)：最终确认数据库字段和关系。
5. `git status` 与指定文件 diff：确认当前未提交改动，之后只做请求范围内的增量查询、实现和聚焦测试。

可用于新对话的简短开场：

> 请先阅读 `CLAUDE.md` 和 `docs/PROJECT_STATUS.md`，以当前代码、shared 契约和 Prisma schema 为事实来源。只处理我指定的页面及直接依赖：字段有可靠来源才接真实数据，没有来源则保持列顺序并返回 `null`、前端显示 `--`；前端基础表格格式和字体大小以“人员”页面为标准。不要连接或写入真实数据库，不运行 migration、seed、应用启动、commit 或 push，除非我明确要求。
