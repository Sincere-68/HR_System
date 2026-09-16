# 后端启动与常见问题

本文记录后端开发模式和已构建产物模式的启动方式，以及本项目常见的环境、Prisma、数据库和端口问题。

## 1. 启动方式

所有命令都在项目根目录执行。

### 开发模式

```powershell
npm run dev:api
```

该命令实际执行 `nest start --watch`：后端会从 `backend/src/main.ts` 编译启动，源码变化后自动重新编译。适合日常开发。

### 使用已构建的 `main.js`

```powershell
npm run build --workspace=@hr-demo/backend
npm run start --workspace=@hr-demo/backend
```

`npm run start --workspace=@hr-demo/backend` 实际执行 `node dist/main.js`，只运行已经生成的 `backend/dist` 产物，不监听源码变化。

源码或 Prisma schema 修改后，不能只重启旧的 `main.js`；应先重新构建，再启动：

```powershell
npm run build --workspace=@hr-demo/backend
npm run start --workspace=@hr-demo/backend
```

成功启动时会看到：

```text
API: http://localhost:3000/api/v1
Swagger: http://localhost:3000/api/docs
```

## 2. 环境变量检查

数据库模式使用 `backend/.env`。至少需要确认：

```env
DEMO_MODE=false
DATABASE_URL="postgresql://用户名:密码@localhost:5432/数据库名?schema=public"
JWT_SECRET="仅本机使用且至少32个字符的随机字符串"
```

演示模式不连接数据库：

```env
DEMO_MODE=true
```

### 注意启动进程中的环境变量覆盖

命令行或 PowerShell 中已经存在的环境变量可能覆盖 `.env` 中的同名值。例如：

```powershell
DEMO_MODE=true npm run dev:api
```

这会让当前进程使用演示模式，即使 `backend/.env` 写的是 `DEMO_MODE=false`。修改 `.env` 后必须停止旧进程并重新启动；已运行的 Node 进程不会自动读取文件的新内容。

不要在日志、文档或聊天中打印 `DATABASE_URL` 的完整内容，以免泄露密码。排查时只确认协议、主机、端口和数据库名即可。

## 3. Prisma Client 生成规则

本项目使用普通 PostgreSQL 直连和 Prisma 本地 binary 引擎，不使用 Prisma Accelerate/Data Proxy。Prisma schema 中的 generator 应保持：

```prisma
generator client {
  provider   = "prisma-client-js"
  engineType = "binary"
}
```

修改 `backend/prisma/schema.prisma` 后，先重新生成：

```powershell
npm run prisma:generate --workspace=@hr-demo/backend
```

生成输出应包含：

```text
Generated Prisma Client ... engine=binary
```

随后按使用的启动方式操作：

```powershell
# 开发模式
npm run dev:api

# 或构建产物模式
npm run build --workspace=@hr-demo/backend
npm run start --workspace=@hr-demo/backend
```

`backend/package.json` 已为 `dev`、`build` 和 `start` 配置 npm 生命周期钩子：执行这些命令时会先自动运行普通的 `prisma generate`，因此通常不需要手动重复生成。不要使用 `prisma generate --no-engine`，也不要为了规避错误把普通 PostgreSQL URL 改成 `prisma://`。如果 Prisma 正在使用 Windows 查询引擎而自动生成遇到文件锁，先停止旧的后端进程，再重新执行启动命令。

## 4. 常见错误

### P1001：无法连接数据库服务器

典型信息：

```text
Can't reach database server at localhost:5432
```

这通常表示 PostgreSQL 服务没有启动，或 `DATABASE_URL` 的主机、端口不正确；它不等同于密码错误。依次检查：

1. PostgreSQL 服务是否已启动；
2. `DATABASE_URL` 是否指向正确的主机和端口；
3. 数据库是否存在；
4. 数据库账号是否允许从该地址连接。

密码错误通常会出现数据库认证失败信息，而不是 `P1001`。

### P6001：URL 必须是 `prisma://` 或 `prisma+postgres://`

典型信息：

```text
InvalidDatasourceError: the URL must start with the protocol prisma:// or prisma+postgres://
```

这表示运行时错误地使用了 Prisma Data Proxy/Accelerate 引擎，而 `DATABASE_URL` 是普通 PostgreSQL URL。不要修改数据库 URL 来适配 Data Proxy。

处理顺序：

1. 停止旧的后端进程；
2. 使用普通命令重新生成 Prisma Client：
   ```powershell
   npm run prisma:generate --workspace=@hr-demo/backend
   ```
3. 如果运行 `main.js`，重新构建后端：
   ```powershell
   npm run build --workspace=@hr-demo/backend
   ```
4. 重新启动后端。

若仍出现 P6001，确认没有使用 `--no-engine`，并确认启动的是当前工作区的 `backend/dist/main.js`，而不是其他目录下的旧产物。

### `The column ... does not exist`

例如：

```text
The column `users.<字段名>` does not exist in the current database.
```

这表示当前数据库结构与代码中的 Prisma schema 或已生成 Client 不一致。先停止后端并确认：

- 目标数据库和 `DATABASE_URL` 是否正确；
- 对应 migration 是否已按顺序应用；
- 当前 `backend/dist` 和 Prisma Client 是否来自最新源码。

不要直接删除字段、重置数据库或执行来源不明的 SQL。确认备份、实际 schema、migration 状态和执行范围后，再由有权限的人员执行已审查的 migration。仅为绕过登录报错而隐藏字段，不代表数据库结构已经修复。

### `EADDRINUSE: address already in use :::3000`

这表示另一个进程已经占用后端端口。优先找到原来的后端窗口并按 `Ctrl+C` 停止，再重新启动。

Windows PowerShell 可查看占用进程：

```powershell
Get-NetTCPConnection -LocalPort 3000 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

确认 PID 确实属于旧后端后，再停止对应进程；不要终止不相关的系统或业务进程。也可以临时在 `backend/.env` 中改用一个未占用端口，并同步调整前端的 `VITE_API_BASE_URL`。

### 后端启动成功但接口返回 401

`401 Unauthorized` 通常表示接口需要 Bearer JWT，并不表示后端没有启动。登录接口不需要旧的默认账号展示；应使用管理员提供的有效账号登录，再将返回的 token 交给前端或 API 客户端。

### 后端启动后页面仍报请求失败

确认：

1. 后端仍在运行；
2. 前端的 `VITE_API_BASE_URL` 指向当前后端地址，默认是 `http://localhost:3000/api/v1`；
3. 浏览器访问的是前端实际启动端口；
4. 浏览器开发者工具中的请求没有指向旧端口或旧进程。

修改前端 `.env` 或后端 `.env` 后，也需要重启对应进程。

## 5. 启动前检查清单

- [ ] 当前命令窗口位于项目根目录；
- [ ] PostgreSQL 已启动（仅 `DEMO_MODE=false` 需要）；
- [ ] `backend/.env` 的 `DEMO_MODE`、`DATABASE_URL` 和 `JWT_SECRET` 已核对；
- [ ] 没有旧的后端进程占用 `3000`；
- [ ] Prisma schema 修改后已执行普通 `prisma generate`；
- [ ] 使用 `main.js` 时已先执行 backend build；
- [ ] 未使用 `prisma generate --no-engine`；
- [ ] 未在未审查、未授权的情况下执行 migration、seed 或数据库恢复操作。

## 6. 停止后端

在运行后端的命令窗口按：

```text
Ctrl+C
```

停止后端后，再修改环境变量或切换演示/数据库模式，避免多个进程同时占用同一个端口或继续使用旧配置。
