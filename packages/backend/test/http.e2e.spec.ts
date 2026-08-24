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
import { DomainModule } from '@/domain/domain.module';

describe('HTTP API', () => {
  const originalWebRoot = process.env.FLOWTRACE_WEB_ROOT;
  let app: INestApplication;
  let webRoot: string;

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
          ],
          migrationsRun: true,
        }),
        DomainModule,
      ],
    }).compile();
    app = module.createNestApplication<NestExpressApplication>();
    configureApp(app);
    configureStaticWeb(app as NestExpressApplication);
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    await rm(webRoot, { recursive: true, force: true });
    if (originalWebRoot === undefined) delete process.env.FLOWTRACE_WEB_ROOT;
    else process.env.FLOWTRACE_WEB_ROOT = originalWebRoot;
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
