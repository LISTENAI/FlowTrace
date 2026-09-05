import { createHash } from 'node:crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { WorkService } from '@/domain/work.service';

export interface MutationScope {
  work: WorkService;
  requestId: string;
  mutationId: string;
  actor?: { userId: string; personId: string; name: string };
  sourceRef?: string;
  reportedAt?: string;
}

export const mutationScope = new AsyncLocalStorage<MutationScope>();

export const receiptId = (actorId: string, requestId: string) =>
  createHash('sha256').update(`${actorId}\0${requestId}`).digest('hex');
