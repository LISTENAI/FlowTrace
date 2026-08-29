import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { fromNodeHeaders } from 'better-auth/node';
import { getAuthRuntime } from '@/auth/auth-runtime';
import { FLOWTRACE_PUBLIC_AUTH } from '@/auth/auth-public';
import type { AuthenticatedRequest } from '@/auth/auth-session';
import { IdentityService } from '@/auth/identity.service';

@Injectable()
export class FlowTraceAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(IdentityService)
    private readonly identities: IdentityService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const runtime = getAuthRuntime();
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      FLOWTRACE_PUBLIC_AUTH,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await runtime.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });
    if (!session) throw new UnauthorizedException('请先登录 FlowTrace');
    request.flowTraceSession = session;
    const identity = await this.identities.current(session.user);
    request.flowTraceIdentity = identity;
    return true;
  }
}
