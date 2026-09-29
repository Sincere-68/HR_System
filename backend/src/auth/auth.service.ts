import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PERMISSIONS, type AuthUser, type LoginResponse, type PermissionCode, type RoleCode } from '@hr-demo/shared';
import * as bcrypt from 'bcrypt';
import { DemoDataService } from '../demo/demo-data.service';
import { PrismaService } from '../prisma/prisma.service';

// Select only authentication and authorization fields. Using `include` on User
// implicitly selects every scalar field, which would make login depend on
// unrelated optional integration columns being present in an older database.
const authUserSelect = {
  id: true,
  username: true,
  passwordHash: true,
  displayName: true,
  employeeId: true,
  role: {
    select: {
      code: true,
      name: true,
      permissions: {
        select: {
          permission: { select: { code: true } },
        },
      },
    },
  },
  dataScopes: { select: { organizationId: true } },
} as const;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly demo: DemoDataService,
  ) {}

  async login(username: string, password: string): Promise<LoginResponse> {
    if (this.demo.enabled) {
      const authUser = this.demo.authenticate(username, password);
      if (!authUser) throw new UnauthorizedException('用户名或密码错误');
      return {
        accessToken: await this.jwt.signAsync({ sub: authUser.id }),
        user: authUser,
      };
    }

    const user = await this.prisma.user.findUnique({ where: { username }, select: authUserSelect });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const authUser = this.mapAuthUser(user);
    return {
      accessToken: await this.jwt.signAsync({ sub: user.id }),
      user: authUser,
    };
  }

  async getAuthUser(userId: string): Promise<AuthUser> {
    if (this.demo.enabled) {
      const authUser = this.demo.getUser(userId);
      if (!authUser) throw new UnauthorizedException('账号不存在或已失效');
      return authUser;
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: authUserSelect });
    if (!user) throw new UnauthorizedException('账号不存在或已失效');
    return this.mapAuthUser(user);
  }

  private mapAuthUser(user: {
    id: string;
    username: string;
    displayName: string;
    employeeId: string | null;
    role: {
      code: string;
      name: string;
      permissions: { permission: { code: string } }[];
    };
    dataScopes: { organizationId: string }[];
  }): AuthUser {
    const role = user.role.code as RoleCode;
    const grantedPermissions = user.role.permissions.map(
      ({ permission }) => permission.code as PermissionCode,
    );
    // 普通员工只保留本人档案只读能力；即使旧数据误配了其他权限，也不会
    // 在认证结果中放大为 HR 业务权限。
    const permissions = role === 'VIEWER'
      ? grantedPermissions.filter((permission) => permission === PERMISSIONS.EMPLOYEE_READ)
      : grantedPermissions;
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role,
      roleName: user.role.name,
      permissions,
      organizationIds: user.dataScopes.map(({ organizationId }) => organizationId),
      employeeId: user.employeeId,
    };
  }
}
