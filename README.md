# 人员管理系统 Demo

这是一个可以在自己电脑上运行的人员管理演示项目。

您可以用它体验：

- 查看人员列表
- 按姓名、工号、部门和任职状态查找人员
- 查看人员详情
- 新增和编辑人员
- 使用不同账号体验不同权限

## 先看这里

- **默认不需要安装 MySQL，也不需要创建数据库。**
- 登录页面已经填好管理员账号，点击“直接进入演示系统”即可。
- 项目中的姓名、手机号和身份证号都是虚构的演示数据。
- 新增或修改的数据只会临时保存在正在运行的后端中。**关闭并重新启动后端后，数据会恢复到最初状态。**
- 请勿输入真实员工的手机号、身份证号或其他个人信息。

---

## 第一次运行

### 第 1 步：安装 Node.js

Node.js 是运行本项目所需的软件。只需安装一次。

1. 打开 <https://nodejs.org/zh-cn/download>。
2. 下载并安装 **LTS（长期支持版）**，建议选择 Node.js 20 或更高版本。
3. 安装时保持默认选项，一直点击“下一步”即可。
4. 安装完成后，关闭并重新打开命令窗口。

检查是否安装成功：

```text
node --version
npm --version
```

如果两条命令都显示版本号，例如 `v24.0.0` 和 `11.0.0`，说明安装成功。

> **命令窗口是什么？** 这是一个可以输入文字命令的窗口。Windows 中叫 PowerShell；macOS 和 Linux 中通常叫终端（Terminal）。下面会分别给出操作方法。

### 第 2 步：安装 Git

Git 用来通过命令行把项目复制到电脑上。只需安装一次。

- **Windows**：打开 <https://git-scm.com/download/win>，下载后保持默认选项完成安装。
- **macOS**：打开终端，执行 `git --version`。如果系统提示安装开发者命令行工具，请按提示安装。
- **Linux（Ubuntu/Debian）**：打开终端，执行 `sudo apt update && sudo apt install git -y`。

安装完成后，关闭并重新打开 PowerShell 或终端，再检查：

```text
git --version
```

显示版本号就说明安装成功。

### 第 3 步：用命令行获取项目

不需要在网页中下载 ZIP，也不需要手动解压。打开命令窗口并执行下面两条命令：

```bash
git clone https://github.com/Sincere-68/HR_System.git
cd HR_System
```

第一条命令会把项目复制到当前目录下的新文件夹中；第二条命令会进入该文件夹。命令执行完成后，后续操作都在这个命令窗口中进行。

> 如果提示 `git` 不是命令或 `command not found`，请返回第 2 步安装 Git，然后关闭并重新打开命令窗口。

### 第 4 步：安装项目所需内容

无论使用 Windows、macOS 还是 Linux，都在项目文件夹中执行：

```text
npm run setup
```

第一次安装通常需要几分钟。看到命令执行完毕，并重新出现可输入命令的一行，就表示安装完成。

这个命令只会下载项目所需的程序包，**不会连接或安装数据库**。

---

## 每次启动项目

这个项目分为两个同时运行的部分：

- **后端**：负责读取和处理演示数据，相当于项目的“工作部分”。
- **前端**：显示在浏览器中的网页，相当于项目的“画面部分”。

因此需要打开 **两个命令窗口**，并让它们同时保持运行。

### Windows（PowerShell）

#### 窗口 1：启动后端

在项目文件夹中打开 PowerShell，执行：

```powershell
npm run dev:api
```

看到下面类似文字，说明后端已经启动：

```text
API: http://localhost:3000/api/v1
Swagger: http://localhost:3000/api/docs
```

不要关闭这个窗口。

#### 窗口 2：启动网页

再打开一个新的 PowerShell 窗口，并确保它也位于项目文件夹中，然后执行：

```powershell
npm run dev:web
```

看到下面类似文字，说明网页已经启动：

```text
Local: http://localhost:5173/
```

同样不要关闭这个窗口。

### macOS / Linux（终端）

#### 窗口 1：启动后端

在项目文件夹中打开终端，执行：

```bash
npm run dev:api
```

看到下面类似文字，说明后端已经启动：

```text
API: http://localhost:3000/api/v1
Swagger: http://localhost:3000/api/docs
```

不要关闭这个终端窗口。

#### 窗口 2：启动网页

再打开一个新的终端窗口，使用 `cd` 进入同一个项目文件夹，然后执行：

```bash
npm run dev:web
```

看到下面类似文字，说明网页已经启动：

```text
Local: http://localhost:5173/
```

同样不要关闭这个终端窗口。

### 打开系统

两个窗口都启动成功后，用浏览器打开：

<http://localhost:5173>

登录页面已经填好管理员账号。直接点击 **“直接进入演示系统”** 即可。

> `localhost` 表示“这台电脑”。网址中的 `3000` 和 `5173` 是两个程序各自使用的编号，也叫端口。

### 停止系统

分别点击两个命令窗口，然后按：

```text
Ctrl + C
```

如果系统询问是否结束任务，输入 `Y` 并按回车。关闭命令窗口也会停止系统。

---

## 演示账号

三个账号的密码都是 `Demo@123`。

| 账号 | 可以做什么 |
| --- | --- |
| `admin` | 查看全部部门，可以新增和编辑，可以看到完整手机号和身份证号 |
| `deptadmin` | 查看产品研发部和运营部，可以新增和编辑，敏感信息会被隐藏一部分 |
| `viewer` | 只查看销售部，不能新增或编辑，敏感信息会被隐藏一部分 |

登录页默认填入：

```text
账号：admin
密码：Demo@123
```

要体验其他权限，只需替换账号，密码不变。

---

## 常见问题

### 提示“node 不是内部或外部命令”或“command not found”

这表示电脑没有找到 Node.js。

1. 确认已经安装 Node.js LTS。
2. 安装后关闭所有 PowerShell 或终端窗口。
3. 重新打开窗口，再运行 `node --version`。
4. 如果仍然失败，重新启动电脑后再试。

### `npm run setup` 下载很慢或失败

首先确认网络可以正常访问 npm。然后在项目文件夹中重新执行：

```text
npm run setup
```

重复执行不会破坏项目。

### 浏览器打不开 `http://localhost:5173`

依次检查：

1. 后端窗口是否仍在运行。
2. 网页窗口是否仍在运行。
3. 网页窗口是否显示了红色错误。
4. 浏览器地址是否完整输入为 `http://localhost:5173`。

如果窗口已经关闭，请重新执行“每次启动项目”中的两条启动命令。

### 登录后提示“请求失败”或人员列表加载失败

通常是后端没有启动。回到运行 `npm run dev:api` 的窗口，确认它没有被关闭，也没有显示红色错误。

### 提示端口 3000 或 5173 已被占用

这通常表示同一个程序已经在另一个窗口中运行。

1. 找到之前打开的命令窗口。
2. 按 `Ctrl + C` 停止旧程序。
3. 再重新启动。

### 新增或修改的人员不见了

这是默认演示方式的正常表现。演示数据只临时保存在内存中，重新启动后端后会恢复。这样每个人下载项目后都能从相同的干净数据开始体验。

---

## 上传到 GitHub 前

本项目的 `.gitignore` 已经排除以下不应上传的内容：

- `node_modules`：安装后生成的大量程序包
- `dist`：编译后生成的文件
- `.env`：可能包含本机数据库密码的设置文件
- 编辑器和测试生成的临时文件

请保留并上传：

- `package-lock.json`：保证其他人安装到一致的程序包版本
- `.env.example` 和 `backend/.env.example`：它们只包含示例，不应放真实密码
- `frontend`、`backend`、`shared` 和文档等源代码

> 把源码上传到 GitHub **不会自动生成一个任何人都能打开的在线网站**。其他人可以下载并按本 README 在自己的电脑上运行。若希望公开部署到互联网，还需要另外选择前端、后端和数据库托管服务。

---

# 进阶说明

下面内容供熟悉开发的人员使用。第一次体验项目时可以全部跳过。

## 技术组成

- 前端：React 19、TypeScript、Vite、Ant Design、React Router、TanStack Query
- 后端：NestJS、TypeScript、Prisma、REST API、Swagger
- 可选数据库：MySQL 8
- 代码目录：`frontend/`、`backend/`、`shared/`
- 本项目不使用 Docker、Redis、MinIO、消息队列或微服务

## 默认演示方式如何工作

默认配置是：

```env
DEMO_MODE=true
```

后端使用进程内的虚构账号、部门和员工数据：

- 登录、JWT、后端权限守卫仍正常工作。
- 员工分页、搜索、筛选、详情、新增和编辑均可使用。
- 管理员、部门管理员、查看者的数据范围与敏感字段脱敏仍由后端执行。
- 数据不会写入硬盘，后端重启后恢复。
- 即使电脑未安装或未启动 MySQL，后端也可以启动。

## 可选：使用 MySQL 保存数据

只有需要让新增和修改在重启后继续保留时，才需要这部分。

### 1. 准备 MySQL

安装 MySQL 8，然后在 MySQL 客户端中创建开发库、测试库和专用账号。请把示例密码换成本机密码：

```sql
CREATE DATABASE IF NOT EXISTS hr_personnel_demo
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE IF NOT EXISTS hr_personnel_demo_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'hr_demo'@'localhost'
  IDENTIFIED BY 'change_this_local_password';
GRANT ALL PRIVILEGES ON hr_personnel_demo.* TO 'hr_demo'@'localhost';
GRANT ALL PRIVILEGES ON hr_personnel_demo_test.* TO 'hr_demo'@'localhost';
FLUSH PRIVILEGES;
```

### 2. 创建后端设置文件

Windows PowerShell：

```powershell
Copy-Item backend/.env.example backend/.env
```

macOS / Linux：

```bash
cp backend/.env.example backend/.env
```

编辑 `backend/.env`：

```env
DEMO_MODE=false
DATABASE_URL="mysql://hr_demo:你的密码@localhost:3306/hr_personnel_demo"
DATABASE_URL_TEST="mysql://hr_demo:你的密码@localhost:3306/hr_personnel_demo_test"
JWT_SECRET="至少32个字符、仅本机使用的随机字符串"
```

如果密码包含 `@`、`:`、`/` 等特殊字符，需要进行 URL 编码。真实的 `.env` 已被 `.gitignore` 排除，不要上传。

### 3. 建表并写入虚构数据

在项目根目录执行：

```text
npm run db:generate
npm run db:migrate
npm run db:seed
```

然后仍使用下面两条命令启动：

```text
npm run dev:api
npm run dev:web
```

切回免数据库演示方式时，把 `backend/.env` 中的 `DEMO_MODE` 改回 `true`，或删除该文件。

## API 地址

启动后端后：

- API 根地址：<http://localhost:3000/api/v1>
- 接口说明页面（Swagger）：<http://localhost:3000/api/docs>
- OpenAPI JSON：<http://localhost:3000/api/docs-json>

除登录外，请求都需要发送 `Authorization: Bearer <token>`。

| 方法 | 地址 | 用途 |
| --- | --- | --- |
| POST | `/auth/login` | 登录 |
| GET | `/auth/me` | 当前用户、角色、权限和部门范围 |
| GET | `/organizations` | 当前账号可以使用的部门 |
| GET | `/employees` | 分页查询和筛选员工 |
| GET | `/employees/:id` | 查看详情 |
| POST | `/employees` | 新增员工 |
| PATCH | `/employees/:id` | 编辑员工 |

## 开发检查命令

```text
npm run typecheck
npm run lint
npm test
npm run build
```

数据库型端到端测试应使用 `DATABASE_URL_TEST` 指向独立测试库，不要使用开发库或任何真实业务数据库。

## 数据安全与权限

- 前端隐藏按钮只是改善操作体验，真正的权限检查由后端完成。
- 后端会再次检查员工是否属于当前账号可访问的部门。
- 无敏感信息权限时，手机号和身份证号由后端处理后再返回，不会把原值发送给浏览器。
- 无敏感权限的编辑页面不会把隐藏后的星号写回员工资料；留空表示不修改。
- MySQL 模式下，详情、新增和编辑会记录审计，但不会在审计记录中保存手机号、身份证号、密码或 JWT。
- 默认 CORS 只允许 `http://localhost:5173`，可通过 `FRONTEND_URL` 调整。
