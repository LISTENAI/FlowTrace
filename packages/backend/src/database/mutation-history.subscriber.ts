import {
  EventSubscriber,
  type EntitySubscriberInterface,
  type InsertEvent,
  type UpdateEvent,
} from 'typeorm';
import { mutationScope } from '@/domain/mutation-scope';

@EventSubscriber()
export class MutationHistorySubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<unknown>) {
    this.stamp(event);
  }
  private stamp(event: InsertEvent<unknown> | UpdateEvent<unknown>) {
    const requestId = mutationScope.getStore()?.mutationId;
    if (
      requestId &&
      event.entity &&
      ['status_history', 'schedule_history', 'version_history'].includes(
        event.metadata.tableName,
      )
    ) {
      (event.entity as { mutationId: string }).mutationId = requestId;
    }
  }
}
