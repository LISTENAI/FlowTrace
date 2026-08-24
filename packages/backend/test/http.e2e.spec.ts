import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { configureApp } from '@/configure-app';
import { configureStaticWeb } from '@/configure-static-web';
import { entities } from '@/database/entities';
import { InitialSchema1724428800000 } from '@/database/migrations/1724428800000-initial-schema';
import { ProjectRhythms1724515200000 } from '@/database/migrations/1724515200000-project-rhythms';
import { SoftDeleteWorkItems1724601600000 } from '@/database/migrations/1724601600000-soft-delete-work-items';
import { VersionSortOrder1724688000000 } from '@/database/migrations/1724688000000-version-sort-order';
import { AiChangeContext1724774400000 } from '@/database/migrations/1724774400000-ai-change-context';
import { DomainModule } from '@/domain/domain.module';
import { McpController } from '@/mcp/mcp.controller';

describe.sequential('HTTP API', () => {
  const originalWebRoot = process.env.FLOWTRACE_WEB_ROOT;
  const originalApiUrl = process.env.FLOWTRACE_API_URL;
  let app: INestApplication;
  let webRoot: string;
  let mcpProjectId: string;
  let mcpRequirementId: string;
  let mcpStageId: string;

  beforeAll(async () => {
    webRoot = await mkdtemp(join(tmpdir(), 'flowtrace-web-'));
    await mkdir(join(webRoot, 'assets'));
    await writeFile(
      join(webRoot, 'index.html'),
      '<!doctype html><html><body>FlowTrace Web</body></html>',
    );
    await writeFile(
      join(webRoot, 'assets', 'app.js'),
      'window.flowtrace = true;',
    );
    process.env.FLOWTRACE_WEB_ROOT = webRoot;
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities,
          migrations: [
            InitialSchema1724428800000,
            ProjectRhythms1724515200000,
            SoftDeleteWorkItems1724601600000,
            VersionSortOrder1724688000000,
            AiChangeContext1724774400000,
          ],
          migrationsRun: true,
        }),
        DomainModule,
      ],
      controllers: [McpController],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    configureStaticWeb(app as NestExpressApplication);
    await app.listen(0, '127.0.0.1');
    process.env.FLOWTRACE_API_URL = `${await app.getUrl()}/api`;
  });

  afterAll(async () => {
    if (app) await app.close();
    await rm(webRoot, { recursive: true, force: true });
    if (originalWebRoot === undefined) delete process.env.FLOWTRACE_WEB_ROOT;
    else process.env.FLOWTRACE_WEB_ROOT = originalWebRoot;
    if (originalApiUrl === undefined) delete process.env.FLOWTRACE_API_URL;
    else process.env.FLOWTRACE_API_URL = originalApiUrl;
  });

  it('serves the Web app and client routes alongside the API', async () => {
    await request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(/FlowTrace Web/);
    await request(app.getHttpServer())
      .get('/projects/example')
      .expect(200)
      .expect(/FlowTrace Web/);
    await request(app.getHttpServer())
      .get('/assets/app.js')
      .expect(200)
      .expect(/window\.flowtrace/);
    await request(app.getHttpServer()).get('/api/health').expect(200);
  });

  it('publishes a machine-readable OpenAPI document', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/openapi.json')
      .expect(200);
    expect(response.body.info.title).toBe('FlowTrace API');
    expect(response.body.paths).toHaveProperty(
      '/api/requirements/{id}/move-version',
    );
    expect(response.body.paths).toHaveProperty('/api/snapshots/versions/{id}');
    expect(response.body.paths).toHaveProperty('/api/search');
    expect(response.body.paths).toHaveProperty(
      '/api/snapshots/requirements/{id}',
    );
  });

  it('serves the stateless remote MCP endpoint outside the API prefix', async () => {
    const response = await request(app.getHttpServer())
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'http-test', version: '1.0.0' },
        },
      })
      .expect(200);

    expect(response.body).toMatchObject({
      jsonrpc: '2.0',
      id: 1,
      result: {
        serverInfo: { name: 'flowtrace', version: '0.2.0' },
        instructions: expect.stringContaining('Project'),
      },
    });

    const tools = await request(app.getHttpServer())
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} })
      .expect(200);
    expect(tools.body.result.tools).toHaveLength(18);
    expect(tools.body.result.tools).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'search' }),
        expect.objectContaining({ name: 'update_stage_status' }),
      ]),
    );
    await request(app.getHttpServer()).get('/mcp').expect(405);
  });

  it('creates a project and a requirement through validated HTTP operations', async () => {
    const projectResponse = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        key: 'WEB',
        name: 'Web 应用',
        templateStages: [{ name: '开发' }, { name: '测试' }],
        source: 'api',
      })
      .expect(201);
    const requirementResponse = await request(app.getHttpServer())
      .post('/api/requirements')
      .send({
        projectId: projectResponse.body.id,
        title: '搭建项目主页',
        source: 'agent',
        agentName: '验收 Agent',
      })
      .expect(201);

    expect(requirementResponse.body.key).toBe('WEB-1');
    expect(requirementResponse.body.stages).toHaveLength(2);
    mcpProjectId = projectResponse.body.id as string;
    mcpRequirementId = requirementResponse.body.id as string;
    mcpStageId = requirementResponse.body.stages[0].id as string;
    const changes = await request(app.getHttpServer())
      .get('/api/changes')
      .query({ since: '2020-01-01T00:00:00.000Z' })
      .expect(200);
    expect(changes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'requirement_created',
          source: 'agent',
          agentName: '验收 Agent',
        }),
      ]),
    );
  });

  it('reads and writes through remote MCP using the real business API', async () => {
    const search = await request(app.getHttpServer())
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'search',
          arguments: { query: 'Web 应用', types: ['project'] },
        },
      })
      .expect(200);
    expect(search.body.result.structuredContent).toMatchObject({
      success: true,
      data: [expect.objectContaining({ key: 'WEB', name: 'Web 应用' })],
    });

    const update = await request(app.getHttpServer())
      .post('/mcp')
      .set('accept', 'application/json, text/event-stream')
      .send({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'update_stage_status',
          arguments: {
            stage_id: mcpStageId,
            status: 'waiting',
            status_reason: '等待测试环境',
            agent_name: '端到端验收',
            reason: '根据项目同步信息更新',
          },
        },
      })
      .expect(200);
    expect(update.body.result.structuredContent).toMatchObject({
      success: true,
      entity: { id: mcpStageId, status: 'waiting' },
      history: {
        status: expect.objectContaining({
          toStatus: 'waiting',
          source: 'agent',
          agentName: '端到端验收',
        }),
      },
      warnings: [],
    });

    const requirement = await request(app.getHttpServer())
      .get(`/api/requirements/${mcpRequirementId}`)
      .expect(200);
    expect(requirement.body.stages[0]).toMatchObject({
      id: mcpStageId,
      status: 'waiting',
      statusReason: '等待测试环境',
    });
    const changes = await request(app.getHttpServer())
      .get('/api/changes')
      .query({
        since: '2020-01-01T00:00:00.000Z',
        requirementId: mcpRequirementId,
      })
      .expect(200);
    expect(changes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityId: mcpStageId,
          type: 'stage_status_changed',
          source: 'agent',
          agentName: '端到端验收',
        }),
      ]),
    );
  });

  it('preserves business history across representative MCP writes', async () => {
    let requestId = 10;
    const callTool = async (
      name: string,
      arguments_: Record<string, unknown>,
    ) => {
      const response = await request(app.getHttpServer())
        .post('/mcp')
        .set('accept', 'application/json, text/event-stream')
        .send({
          jsonrpc: '2.0',
          id: requestId++,
          method: 'tools/call',
          params: { name, arguments: arguments_ },
        })
        .expect(200);
      expect(response.body.result.isError).not.toBe(true);
      return response.body.result.structuredContent as Record<string, any>;
    };

    const [owner, currentVersion, nextVersion] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/people')
        .send({ name: '桂子', note: '端到端演示负责人' })
        .expect(201),
      request(app.getHttpServer())
        .post(`/api/projects/${mcpProjectId}/versions`)
        .send({ name: '2.8' })
        .expect(201),
      request(app.getHttpServer())
        .post(`/api/projects/${mcpProjectId}/versions`)
        .send({ name: '3.0' })
        .expect(201),
    ]);

    const addedStage = await callTool('add_stage', {
      requirement_id: mcpRequirementId,
      name: '板上验证',
      order: 1,
      owner_ids: [owner.body.id],
      planned_start_at: '2026-08-25T01:00:00.000Z',
      planned_end_at: '2026-08-25T10:00:00.000Z',
      agent_name: '端到端验收',
    });
    const validationStageId = addedStage.entity.id as string;

    const reportedBug = await callTool('report_bug', {
      requirement_id: mcpRequirementId,
      title: '二次连接可能失败',
      owner_ids: [owner.body.id],
      discovered_stage_id: mcpStageId,
      target_version_id: currentVersion.body.id,
      agent_name: '端到端验收',
      reason: '根据测试结果建立独立跟踪',
    });
    const bugId = reportedBug.entity.id as string;
    const bugKey = reportedBug.entity.key as string;
    const startedBug = await callTool('update_bug_status', {
      bug_id: bugId,
      status: 'in_progress',
      effective_at: '2026-08-23T07:00:00.000Z',
      actual_start_at: '2026-08-23T07:00:00.000Z',
      agent_name: '端到端验收',
      reason: '补录实际开始修复时间',
    });
    expect(startedBug).toMatchObject({
      success: true,
      entity: {
        id: bugId,
        key: bugKey,
        status: 'in_progress',
        actualStartAt: '2026-08-23T07:00:00.000Z',
      },
      history: {
        status: expect.objectContaining({
          effectiveAt: '2026-08-23T07:00:00.000Z',
          source: 'agent',
        }),
      },
    });

    const rescheduled = await callTool('reschedule_stage', {
      stage_id: validationStageId,
      planned_end_at: '2026-08-28T10:00:00.000Z',
      reason: 'PCB 交付延期',
      agent_name: '端到端验收',
    });
    expect(rescheduled).toMatchObject({
      success: true,
      entity: {
        id: validationStageId,
        baselineEndAt: '2026-08-25T10:00:00.000Z',
        plannedEndAt: '2026-08-28T10:00:00.000Z',
      },
      history: {
        schedule: expect.objectContaining({
          oldEndAt: '2026-08-25T10:00:00.000Z',
          newEndAt: '2026-08-28T10:00:00.000Z',
          source: 'agent',
        }),
      },
    });

    const moved = await callTool('move_requirement_to_version', {
      requirement_id: mcpRequirementId,
      version_id: nextVersion.body.id,
      effective_at: '2026-08-24T02:00:00.000Z',
      reason: '调整交付窗口',
      agent_name: '端到端验收',
    });
    expect(moved).toMatchObject({
      success: true,
      entity: {
        id: mcpRequirementId,
        versionId: nextVersion.body.id,
        versionHistory: [
          expect.objectContaining({
            toVersionId: nextVersion.body.id,
            effectiveAt: '2026-08-24T02:00:00.000Z',
            source: 'agent',
          }),
        ],
      },
    });

    const hardwareProject = await request(app.getHttpServer())
      .post('/api/projects')
      .send({
        key: 'BOARD2',
        name: '样件验证项目',
        templateStages: [{ name: '首次打样' }],
      })
      .expect(201);
    const hardwareRequirement = await request(app.getHttpServer())
      .post('/api/requirements')
      .send({ projectId: hardwareProject.body.id, title: '核心板首样' })
      .expect(201);
    const dependency = await callTool('add_dependency', {
      successor_type: 'stage',
      successor_id: validationStageId,
      predecessor_type: 'stage',
      predecessor_id: hardwareRequirement.body.stages[0].id,
      note: '板上验证需要首样',
      agent_name: '端到端验收',
    });
    expect(dependency).toMatchObject({
      success: true,
      entity: { active: true, satisfied: false, source: 'agent' },
      warnings: [expect.objectContaining({ code: 'dependency_not_satisfied' })],
    });

    const finalRequirement = await request(app.getHttpServer())
      .get(`/api/requirements/${mcpRequirementId}`)
      .expect(200);
    expect(finalRequirement.body.id).toBe(mcpRequirementId);
    expect(finalRequirement.body.bugs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: bugId, status: 'in_progress' }),
      ]),
    );
  });

  it('renames a person without changing the stable identity', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/people')
      .send({ name: '小树', note: '研发协作' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/api/people/${created.body.id}`)
      .send({ name: '小澍', note: '项目协作' })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: created.body.id,
      name: '小澍',
      note: '项目协作',
      active: true,
    });
  });

  it('rejects unknown fields instead of silently accepting ambiguous Agent input', async () => {
    await request(app.getHttpServer())
      .post('/api/projects')
      .send({ key: 'BAD', name: '错误输入', unexpected: true })
      .expect(400);
  });
});
