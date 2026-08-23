import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { configureApp } from '@/configure-app';
import { entities } from '@/database/entities';
import { InitialSchema1724428800000 } from '@/database/migrations/1724428800000-initial-schema';
import { DomainModule } from '@/domain/domain.module';

describe('HTTP API', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities,
          migrations: [InitialSchema1724428800000],
          migrationsRun: true,
        }),
        DomainModule,
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
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

  it('rejects unknown fields instead of silently accepting ambiguous Agent input', async () => {
    await request(app.getHttpServer())
      .post('/api/projects')
      .send({ key: 'BAD', name: '错误输入', unexpected: true })
      .expect(400);
  });
});
