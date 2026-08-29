import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { getAuthRuntime } from '@/auth/auth-runtime';
import { PublicAuth } from '@/auth/auth-public';
import type { AuthenticatedRequest } from '@/auth/auth-session';

@ApiTags('认证')
@PublicAuth()
@Controller('auth-config')
export class AuthConfigController {
  @Get()
  async get() {
    const runtime = getAuthRuntime();
    return {
      provider: runtime.provider,
      setupRequired: await runtime.setupRequired(),
    };
  }
}

@ApiTags('当前用户')
@Controller('me')
export class CurrentIdentityController {
  @Get()
  get(@Req() request: AuthenticatedRequest) {
    const identity = request.flowTraceIdentity;
    if (!identity) throw new UnauthorizedException('请先登录 FlowTrace');
    return identity;
  }
}
