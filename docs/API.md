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
| `status` | enum | `ACTIVE` 或 `INACTIVE` |
| `page` | integer | 从 1 开始 |
| `pageSize` | integer | 1-100，默认 10 |

响应：

```json
{
  "data": [
    {
      "id": "...",
      "employeeNo": "DEMO-1001",
      "name": "林知夏",
      "mobile": "138****1001",
      "idCardNo": "110101********1021",
      "organizationId": "...",
      "organizationName": "产品研发部",
      "employmentStatus": "ACTIVE",
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "pageSize": 10,
    "total": 2,
    "totalPages": 1
  }
}
```

手机号和身份证号是否脱敏只由后端权限决定。

### GET `/employees/:id`

返回员工详情。成功查看后写入 `DETAIL_VIEW` 审计。越权资源统一返回“员工不存在或不在当前数据范围内”，不向请求者确认该 ID 是否真实存在。

### POST `/employees`

需要 `employee.create`，目标部门必须在账号数据范围内。

```json
{
  "employeeNo": "DEMO-1005",
  "name": "测试员工",
  "mobile": "13800001005",
  "idCardNo": "110101199203181021",
  "organizationId": "部门 ID",
  "employmentStatus": "ACTIVE"
}
```

员工和首条当前任职记录在同一事务中创建，成功后写 `CREATE` 审计。

### PATCH `/employees/:id`

需要 `employee.update`。Body 是 POST 字段的任意子集。原部门与目标部门都必须可访问；状态变化会在同一事务中关闭原当前任职记录并创建新记录。

无敏感读取权限的用户编辑时可省略 `mobile`、`idCardNo`，后端会保持原值。前端不会发送掩码。

## 权限键

- `employee.read`
- `employee.create`
- `employee.update`
- `employee.sensitive.read`
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

`audit_logs.metadata` 只保存 `changedFields` 等非敏感元数据。手机号、身份证号、密码和 JWT 不写入审计。导出功能本期暂缓，因此虽然数据库枚举预留 `EXPORT`，当前没有导出接口或导出日志。
