import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { DEMO_JWT_SECRET } from '../config/env.validation';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? DEMO_JWT_SECRET,
    });
  }

  async validate(payload: { sub?: string }): Promise<AuthenticatedUser> {
    if (!payload.sub) throw new UnauthorizedException('访问令牌无效');
    return this.authService.getAuthUser(payload.sub);
  }
}
