# HR 系统

HR 人员主数据与模板驱动绩效管理系统，采用前后端分离架构，业务数据以 PostgreSQL 和 Prisma schema/migration 为唯一持久化事实来源。

系统包含两个业务域：

- **人员信息**：人员主档案、任职历史、组织树、汇报关系、证件与附属资料、合同、入职、异动、离职及人员统计。
- **绩效管理**：Markdown/手动模板、考核模块、指标下发、串行评分、结果调整、绩效活动、后续审核/确认/审批、金额基数快照、结果修订审计及飞书个人待办。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19、TypeScript、Vite、Ant Design、React Router、TanStack Query |
| 后端 | NestJS、TypeScript、Passport JWT、Swagger、Helmet、class-validator |
| 数据层 | PostgreSQL、Prisma ORM、Prisma Migration |
| 共享契约 | `shared/` TypeScript 类型、枚举和目录常量 |
| 飞书 | `@larksuiteoapi/node-sdk`、Feishu Open API、卡片 HTTP 回调/SDK 长连接、网页 OAuth |
| 工作区 | npm workspaces：`frontend`、`backend`、`shared` |

运行要求：Node.js `>=20`、npm `>=10`、PostgreSQL 14 或更高版本。

## 目录结构

```text
frontend/                         React 页面、路由、Query hooks、样式
backend/src/                      NestJS 模块、Controller、Service、DTO
backend/prisma/schema.prisma      PostgreSQL Prisma schema
backend/prisma/migrations/        版本化数据库迁移
backend/prisma/seed.ts            目录、权限和初始管理员初始化
shared/src/                       前后端共享类型和固定目录
  docs/API.md                     REST 接口与字段口径
  docs/PROJECT_STATUS.md          当前实现状态与迁移记录
```

## 数据库配置

项目正式运行使用 PostgreSQL。复制后端环境变量示例：

### Windows PowerShell

```powershell
Copy-Item backend/.env.example backend/.env
```

### macOS / Linux

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`，至少配置：

```env
DATABASE_URL="postgresql://hr_demo:本地密码@localhost:5432/hr_personnel_demo?schema=public"
DATABASE_URL_TEST="postgresql://hr_demo:本地密码@localhost:5432/hr_personnel_demo_test?schema=public"
JWT_SECRET="至少 32 个字符的随机字符串"
JWT_EXPIRES_IN="8h"
FRONTEND_URL="http://localhost:5173"
BOOTSTRAP_ADMIN_PASSWORD="首次初始化管理员密码"
```

数据库连接账号需要具备目标 schema 的建表、建类型、建索引及外键权限。生产环境使用独立数据库和最小权限账号，不要复用开发库或测试库。

### 初始化与迁移

在项目根目录执行：

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

`db:migrate` 执行仓库中的历史 migration；`db:seed` 初始化权限、角色、组织目录、职位/公司目录及首次管理员。管理员创建后可从实际 `.env` 删除 `BOOTSTRAP_ADMIN_PASSWORD`。

已有数据库同步权限策略时：

```bash
npm run db:sync-access-policy
```

生产部署只使用：

```bash
npm run db:generate
npm run db:migrate
```

不要使用以下会破坏或绕过迁移历史的命令：

```text
prisma migrate reset
prisma db push --force-reset
```

所有可能影响历史数据的 schema 变更必须通过新的 Prisma migration 完成，并在执行前检查生成 SQL、备份目标数据库和确认外键影响。

## 跨平台运行

后端和前端分别运行，需要两个终端窗口。所有命令均在项目根目录执行。

### Windows PowerShell

窗口一：

```powershell
npm run dev:api
```

窗口二：

```powershell
npm run dev:web
```

开发地址：

```text
API       http://localhost:3000/api/v1
Swagger   http://localhost:3000/api/docs
Frontend  http://localhost:5173
```

停止进程：在对应窗口按 `Ctrl + C`。

### macOS

终端一：

```bash
npm run dev:api
```

终端二：

```bash
npm run dev:web
```

### Linux

```bash
npm run dev:api
```

另开终端：

```bash
npm run dev:web
```

macOS/Linux 的 PostgreSQL 服务、反向代理和进程管理由部署环境负责；开发时确保 `DATABASE_URL` 可从当前 shell 环境或 `backend/.env` 读取。

## 构建、类型检查与测试

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

按 workspace 执行：

```bash
npm run build --workspace shared
npm run typecheck --workspace backend
npm run typecheck --workspace frontend
npm run test --workspace backend -- --runInBand
npm run test --workspace frontend -- --run
```

数据库型测试必须使用独立的 `DATABASE_URL_TEST`，禁止连接生产数据库。Prisma 静态校验可使用占位连接串而不建立数据库连接：

```bash
DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder npx prisma validate --schema backend/prisma/schema.prisma
```

## 人员信息域

人员模型按业务对象拆分，不把页面宽表作为单一数据表：

- `Employee`：自然人长期主档案；离职再入职沿用原人员 ID 和工号。
- `EmploymentPeriod`：每次入职、离职、重新入职的任职周期。
- `EmployeeAssignment`：部门、职位、职级、职务、地点和任职有效期；当前主要任职保持历史可追溯。
- `Organization`：通过 `parentId` 表达可扩展组织树；数据范围为授权节点及全部下级。
- `ReportingRelationship`：独立保存员工与上级关系及关系历史。
- `EmployeeIdentityDocument`、教育、履历、家庭、合同等：一对多附属业务记录。

人员接口统一位于 `/api/v1`，登录后使用 Bearer JWT：

```text
GET    /employees
GET    /employees/:id
POST   /employees
PATCH  /employees/:id
GET    /organizations
GET    /employment/records
GET    /contracts
GET    /analytics/roster
```

后端服务强制执行组织范围、当前/历史任职口径和业务日期判断。前端隐藏按钮不构成安全边界。字段没有可靠来源时返回 `null`，前端显示 `--`，不使用相似字段填充。

更多字段来源和权限口径见 [`docs/API.md`](docs/API.md) 与 [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)。

## 绩效管理域

### 模板与执行模型

绩效模板由 Markdown 导入或手动配置生成。Markdown 解析只产生可确认的结构，最终执行定义由 HR 在模板编辑器中确认并发布。模块类型：

- `METRIC`：后端适配器计算，保存原始指标数据、计算明细和模块分数。
- `EVALUATION`：执行人提交 0–100 模块总分及评语。
- `ADJUSTMENT`：固定权重计算后的额外加分/扣分；工作失误扣减、超额奖励/贡献可配置为无调整时跳过。

固定权重模块合计必须为 100%。最终结果使用已保存的模块分数、模块权重和调整项计算，并冻结：

```text
最终分数 = max(0, Σ(模块得分 × 模块权重 ÷ 100) + 调整项)
最终金额 = 金额基数快照 × 最终分数 ÷ 100
```

考核完成后保存金额基数 ID、版本、金额、公式、最终分数和实际金额；后续审核、本人确认、审批和 HR 归档不重新计算结果。

### 活动与任务

主要接口：

```text
GET    /performance/templates
POST   /performance/templates/parse
POST   /performance/templates
POST   /performance/templates/:id/versions
POST   /performance/templates/:id/versions/:versionId/publish
GET    /performance/cycles
GET    /performance/cycles/:id
POST   /performance/cycles
POST   /performance/cycles/:id/start
GET    /performance/my-tasks
POST   /performance/tasks/:id/submit
GET    /performance/my-workflow-tasks
POST   /performance/workflow-tasks/:id/submit
GET    /performance/results
GET    /performance/results/:id
```

活动启动时按活动实例绑定被考核人创建任务。工作流中的 `CONFIRMATION`（本人确认）为系统固定执行人：任务打开时从 `PerformanceInstance.employee` 绑定被考核员工，不使用模板中可配置的员工、岗位或职务。

### 快照与审计

模板定义、模块、指标、执行人和流程步骤在活动/任务创建时保存快照。评分、金额基数、结果修改、流程动作、详情查看和通知投递分别保留审计或业务历史。已完成/归档结果展示冻结快照，不因详情查询自动重算。

## 飞书集成

飞书是个人通知和身份确认通道，不是业务数据源。系统只向个人 `open_id` 发送消息，不使用群聊 `chat_id`。

### 配置

在 `backend/.env` 配置，不要把真实值写入 Git：

```env
FEISHU_ENABLED=true
FEISHU_APP_ID="飞书自建应用 App ID"
FEISHU_APP_SECRET="飞书自建应用 App Secret"
FEISHU_LONG_CONNECTION_ENABLED=true
FEISHU_VERIFICATION_TOKEN="事件与回调中的 Verification Token"
FEISHU_ENCRYPT_KEY="事件与回调中的 Encrypt Key"

FEISHU_OAUTH_REDIRECT_URI="https://hr.example.com/performance/feishu-task-inbox"
FEISHU_TASK_INBOX_URL="https://hr.example.com/performance/feishu-task-inbox"
```

变量来源：

- App ID、App Secret：飞书开放平台 → 凭证与基础信息。
- Verification Token、Encrypt Key：飞书开放平台 → 事件与回调 → 事件配置。
- OAuth 回调地址：飞书开放平台安全设置/H5 网页授权相关配置，必须与 `FEISHU_OAUTH_REDIRECT_URI` 完全一致。

### 通知和身份链路

绩效活动按“活动 + 执行人”聚合发送一张个人汇总卡片。卡片只显示活动名称、待提交评价数、待审核/流程处理数和“查看详情”按钮。

员工身份链路：

```text
Employee.workEmail / mobile
  → 飞书通讯录解析唯一 open_id
  → sendCardToOpenId
  → 飞书 OAuth 返回真实 open_id
  → 与任务执行人联系方式再次解析并比对
  → 签发活动限定的绩效待办 JWT
```

员工可以没有项目内部 `User` 账号；只要 `Employee` 联系方式能唯一匹配飞书身份，就能完成自己的评价、审核、驳回、确认或归档。

项目待办页面：

```text
/performance/feishu-task-inbox
```

专用接口：

```text
POST /performance/feishu-task-inbox/session
GET  /performance/feishu-task-inbox
POST /performance/feishu-task-inbox/assessment-tasks/:id/submit
POST /performance/feishu-task-inbox/workflow-tasks/:id/submit
```

专用 token 保存在浏览器 `sessionStorage`，不覆盖普通 HR JWT。后端按会话绑定的 `employeeId + cycleId` 查询和提交，客户端不能通过 URL、请求参数或 body 扩大范围。

### 回调模式

支持两种卡片回调模式：

- SDK 长连接：`FEISHU_LONG_CONNECTION_ENABLED=true`，适用于后端位于内网的部署。
- HTTP 回调：保留 `/api/v1/performance/feishu/card-actions`，需要在飞书开放平台配置可访问的回调地址和校验参数。

新的汇总卡主要通过网页授权进入项目待办；旧的卡片内直接评分/审核回调仍保留用于兼容历史卡片。

## 云端部署要点

生产部署需要三个可访问组件：

```text
浏览器 / 飞书 H5
        ↓ HTTPS
前端静态站点
        ↓ /api/v1 反向代理
NestJS API
        ↓
PostgreSQL
```

前端构建时配置：

```env
VITE_API_BASE_URL="https://hr.example.com/api/v1"
```

如果前后端同源并由反向代理转发，使用：

```env
VITE_API_BASE_URL="/api/v1"
```

飞书 OAuth 回调必须指向飞书客户端可访问的 HTTPS 前端地址。`localhost`、本机磁盘路径和仅当前电脑可访问的地址不能作为云端飞书 H5 回调地址。

云端发布顺序：

```bash
npm ci
npm run db:generate
npm run db:migrate
npm run build
```

然后重启 API 进程并发布 `frontend/dist`。迁移只使用 `prisma migrate deploy`，不得使用 reset 或强制 db push。

## 安全约束

- 不在代码、测试、文档、日志、`.env.example` 或 Git 中写入真实 App Secret、Verification Token、Encrypt Key、数据库密码或 JWT Secret。
- 真实环境变量只存放在部署平台 secret、服务器环境或被 `.gitignore` 排除的 `.env`。
- 不记录 OAuth code、user access token、open_id、卡片 token 和员工联系方式到普通日志或审计 metadata。
- 所有组织范围、任务归属、执行人身份和状态流转由后端验证。
- 正式业务记录使用归档、停用或取消，不通过物理删除破坏历史。
- migration、seed、生产启动、数据库写入和 schema 破坏性变更应在部署流程中显式审批。

## 相关文档

- [`docs/API.md`](docs/API.md)：接口、字段来源、错误和飞书接口说明。
- [`docs/PROJECT_STATUS.md`](docs/PROJECT_STATUS.md)：当前菜单、已实现功能、迁移状态和已知限制。
- [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)：实际数据库模型。
- [`backend/prisma/migrations/`](backend/prisma/migrations/)：数据库迁移历史。
