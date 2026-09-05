import {
  BadRequestException,
  ConflictException,
  Injectable,
  Inject,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import { isUUID } from 'class-validator';
import { defer, lastValueFrom } from 'rxjs';
import type { AuthenticatedRequest } from '@/auth/auth-session';
import { WorkService } from '@/domain/work.service';
import { mutationScope, receiptId } from '@/domain/mutation-scope';
import {
  MutationReceiptEntity,
  ChangeEventEntity,
  StatusHistoryEntity,
  ScheduleHistoryEntity,
  VersionHistoryEntity,
} from '@/database/entities';

const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)]),
        )
      : value;

@Injectable()
export class MutationInterceptor implements NestInterceptor {
  constructor(
    @Inject(DataSource) private readonly source: DataSource,
    @Inject(WorkService) private readonly work: WorkService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest<
      AuthenticatedRequest & {
        method: string;
        originalUrl: string;
        body?: Record<string, unknown>;
      }
    >();
    if (
      !['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) ||
      /\/changes\/preview(?:\?|$)/.test(request.originalUrl)
    )
      return next.handle();
    if (/\/batch(?:\?|$)/.test(request.originalUrl)) {
      const identity = request.flowTraceIdentity;
      return defer(() =>
        mutationScope.run(
          {
            work: this.work,
            requestId: randomUUID(),
            mutationId: randomUUID(),
            actor: identity
              ? {
                  userId: identity.user.id,
                  personId: identity.person.id,
                  name: identity.person.name,
                }
              : undefined,
          },
          () => lastValueFrom(next.handle()),
        ),
      );
    }
    return defer(() =>
      this.source.transaction(async (manager) => {
        const header = request.headers['x-flowtrace-request-id'];
        if (
          header !== undefined &&
          (typeof header !== 'string' || !isUUID(header))
        )
          throw new BadRequestException(
            'X-FlowTrace-Request-Id 必须是完整 UUID',
          );
        const requestId = typeof header === 'string' ? header : randomUUID();
        const identity = request.flowTraceIdentity;
        const actor = identity
          ? {
              userId: identity.user.id,
              personId: identity.person.id,
              name: identity.person.name,
            }
          : undefined;
        if (header && !actor)
          throw new BadRequestException('幂等写入必须具有已认证身份');
        const id = receiptId(actor?.userId ?? 'unattributed', requestId);
        const fingerprint = createHash('sha256')
          .update(
            JSON.stringify(
              canonical({
                method: request.method,
                path: request.originalUrl,
                body: request.body,
              }),
            ),
          )
          .digest('hex');
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `flowtrace:request:${id}`,
        ]);
        const receipts = manager.getRepository(MutationReceiptEntity);
        const prior = await receipts.findOneBy({ id });
        const response = context.switchToHttp().getResponse<{
          statusCode: number;
          setHeader(name: string, value: string): void;
        }>();
        response.setHeader('X-FlowTrace-Request-Id', requestId);
        const envelope = request.headers['x-flowtrace-result'] === 'receipt';
        if (prior) {
          if (prior.fingerprint !== fingerprint)
            throw new ConflictException(
              '执行标识已用于不同操作，请保留原参数重试或为新操作使用新标识',
            );
          response.statusCode =
            envelope && prior.statusCode === 204 ? 200 : prior.statusCode;
          return envelope ? prior.response : prior.response.data;
        }
        const scoped = this.work.scopedTo(manager);
        const mutationId = randomUUID();
        const data = await mutationScope.run(
          {
            work: scoped,
            requestId,
            mutationId,
            actor,
            sourceRef:
              typeof request.body?.sourceRef === 'string'
                ? request.body.sourceRef
                : undefined,
            reportedAt:
              typeof request.body?.reportedAt === 'string'
                ? request.body.reportedAt
                : undefined,
          },
          () => lastValueFrom(next.handle()),
        );
        const changes = await manager.getRepository(ChangeEventEntity).find({
          where: { mutationId },
          order: { occurredAt: 'ASC', id: 'ASC' },
        });
        const history = {
          status: await manager
            .getRepository(StatusHistoryEntity)
            .findBy({ mutationId }),
          schedule: await manager
            .getRepository(ScheduleHistoryEntity)
            .findBy({ mutationId }),
          version: await manager
            .getRepository(VersionHistoryEntity)
            .findBy({ mutationId }),
        };
        const payload = {
          data: data ?? null,
          mutation: {
            id: mutationId,
            requestId,
            status: 'committed',
            actor,
            changes: await scoped.hydrateChanges(changes),
            history,
          },
        };
        await receipts.save(
          receipts.create({
            id,
            requestId,
            actorUserId: actor?.userId ?? 'unattributed',
            fingerprint,
            statusCode: response.statusCode,
            response: JSON.parse(JSON.stringify(payload)),
          }),
        );
        if (envelope && response.statusCode === 204) response.statusCode = 200;
        return envelope ? payload : data;
      }),
    );
  }
}
