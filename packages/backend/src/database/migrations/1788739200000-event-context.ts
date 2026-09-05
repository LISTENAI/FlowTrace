import type { MigrationInterface, QueryRunner } from 'typeorm';

export class EventContext1788739200000 implements MigrationInterface {
  name = 'EventContext1788739200000';

  async up(runner: QueryRunner): Promise<void> {
    await runner.query(
      'ALTER TABLE "change_events" ADD COLUMN "versionId" uuid, ADD COLUMN "relatedVersionId" uuid, ADD COLUMN "eventContext" jsonb',
    );
    await runner.query(
      'CREATE INDEX "IDX_changes_version_page" ON "change_events" ("versionId", "occurredAt", "id")',
    );
    await runner.query(
      'CREATE INDEX "IDX_changes_related_version_page" ON "change_events" ("relatedVersionId", "occurredAt", "id")',
    );
    // Legacy names were not captured at occurrence. Mark reconstructed context
    // explicitly; version membership can be recovered from migration history.
    const [events, requirements, projects, versions, histories, bugs] =
      await Promise.all([
        runner.query('SELECT * FROM "change_events"'),
        runner.query(
          'SELECT "id", "key", "title", "versionId" FROM "requirements"',
        ),
        runner.query('SELECT "id", "key", "name" FROM "projects"'),
        runner.query('SELECT "id", "name" FROM "versions"'),
        runner.query(
          'SELECT * FROM "version_history" ORDER BY "changedAt" ASC',
        ),
        runner.query('SELECT "id", "targetVersionId" FROM "bugs"'),
      ]);
    const byId = (rows: Record<string, any>[]) =>
      new Map(rows.map((row) => [row.id, row]));
    const requirementMap = byId(requirements),
      projectMap = byId(projects),
      versionMap = byId(versions),
      bugMap = byId(bugs);
    for (const event of events) {
      const requirement = requirementMap.get(event.requirementId);
      const timeline = histories.filter(
        (item: any) => item.requirementId === event.requirementId,
      );
      const prior = timeline
        .filter(
          (item: any) => new Date(item.changedAt) <= new Date(event.occurredAt),
        )
        .at(-1);
      const requirementVersion = prior
        ? prior.toVersionId
        : timeline.length
          ? timeline[0].fromVersionId
          : requirement?.versionId;
      const versionId =
        event.entityType === 'version'
          ? event.entityId
          : event.type === 'requirement_version_changed'
            ? event.details?.toVersionId
            : event.entityType === 'bug'
              ? (bugMap.get(event.entityId)?.targetVersionId ??
                requirementVersion)
              : requirementVersion;
      const relatedVersionId =
        event.type === 'requirement_version_changed'
          ? event.details?.fromVersionId
          : event.details?.before?.targetVersionId;
      const { versionId: _currentVersion, ...identity } = requirement ?? {};
      const context = {
        accuracy: 'reconstructed',
        project: projectMap.get(event.projectId),
        requirement: requirement ? identity : undefined,
        version: versionMap.get(versionId),
        relatedVersion: versionMap.get(relatedVersionId),
      };
      await runner.query(
        'UPDATE "change_events" SET "versionId" = $1, "relatedVersionId" = $2, "eventContext" = $3 WHERE "id" = $4',
        [
          versionId ?? null,
          relatedVersionId ?? null,
          JSON.stringify(context),
          event.id,
        ],
      );
    }
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query('DROP INDEX "IDX_changes_version_page"');
    await runner.query('DROP INDEX "IDX_changes_related_version_page"');
    await runner.query(
      'ALTER TABLE "change_events" DROP COLUMN "versionId", DROP COLUMN "relatedVersionId", DROP COLUMN "eventContext"',
    );
  }
}
