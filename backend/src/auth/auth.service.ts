import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser, LoginResponse, PermissionCode, RoleCode } from '@hr-demo/shared';
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
    role: {
      code: string;
      name: string;
      permissions: { permission: { code: string } }[];
    };
    dataScopes: { organizationId: string }[];
  }): AuthUser {
    const role = user.role.code as RoleCode;
    // 普通账户当前仅能完成登录，尚未开放业务数据访问。这里在每次
    // JWT 解析时强制收敛权限，避免旧种子数据中的角色权限继续生效。
    const permissions = role === 'VIEWER'
      ? []
      : user.role.permissions.map(({ permission }) => permission.code as PermissionCode);
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role,
      roleName: user.role.name,
      permissions,
      organizationIds: user.dataScopes.map(({ organizationId }) => organizationId),
    };
  }
}
