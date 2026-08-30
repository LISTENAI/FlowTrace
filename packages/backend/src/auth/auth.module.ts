import { Module, OnApplicationShutdown } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  AuthConfigController,
  CurrentIdentityController,
} from '@/auth/auth.controller';
import { FlowTraceAuthGuard } from '@/auth/auth.guard';
import { getAuthRuntime } from '@/auth/auth-runtime';
import { IdentityService } from '@/auth/identity.service';
import { FLOWTRACE_AUTH_PROVIDER } from '@/auth/provider';

class AuthLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown() {
    await getAuthRuntime().pool.end();
  }
}

@Module({
  controllers: [AuthConfigController, CurrentIdentityController],
  providers: [
    IdentityService,
    AuthLifecycle,
    {
      provide: FLOWTRACE_AUTH_PROVIDER,
      useFactory: () => getAuthRuntime().provider,
    },
    { provide: APP_GUARD, useClass: FlowTraceAuthGuard },
  ],
})
export class AuthModule {}
