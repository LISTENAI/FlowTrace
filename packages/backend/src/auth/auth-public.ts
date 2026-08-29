import { SetMetadata } from '@nestjs/common';

export const FLOWTRACE_PUBLIC_AUTH = 'flowtrace:public-auth';
export const PublicAuth = () => SetMetadata(FLOWTRACE_PUBLIC_AUTH, true);
