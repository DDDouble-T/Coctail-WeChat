import assert from 'node:assert/strict';
import { test } from 'node:test';
import request from 'supertest';
import { createApp } from '../server/src/app';
import { createCatalogRepository } from '../server/src/catalog';
import { createClickRepository } from '../server/src/clicks';
import { cocktails } from '../server/src/builtin';

test('点击按酒谱 ID 事务创建并累加，统计不写入酒谱集合', async () => {
  const records = new Map<unknown, any>();
  const clicks = createClickRepository({
    collection(name) {
      assert.equal(name, 'cocktail_stats');
      return { doc: (id) => id };
    },
    async runTransaction(callback) {
      await callback({
        async get(document) { return { data: () => records.get(document) }; },
        async set(document, data) { records.set(document, data); },
      });
    },
  });
  await clicks.recordClick('negroni');
  await clicks.recordClick('negroni');
  await clicks.recordClick('daiquiri');
  assert.equal(records.get('negroni').click_count, 2);
  assert.equal(records.get('daiquiri').click_count, 1);
  assert.equal(records.get('negroni').id, 'negroni');
  assert.ok(Number.isFinite(Date.parse(records.get('negroni').last_clicked_at)));
  records.get('negroni').click_count = -1;
  await assert.rejects(clicks.recordClick('negroni'), /统计数据无效/);
});

test('点击接口校验酒谱，每次仅加一，读取详情不会增加，数据库失败返回503', async () => {
  const recorded: string[] = [];
  let fail = false;
  const app = createApp({
    repository: createCatalogRepository(), onError() {},
    clicks: { async recordClick(id) { if (fail) throw new Error('offline'); recorded.push(id); } },
  });
  const id = cocktails[0].id;
  await request(app).get(`/api/cocktails/${id}`).expect(200);
  await request(app).post(`/api/cocktails/${id}/clicks`).send({ click_count: 99999 }).expect(204);
  await request(app).post(`/api/cocktails/${id}/clicks`).expect(204);
  await request(app).post('/api/cocktails/not-a-recipe/clicks').expect(404);
  await request(app).post('/api/cocktails/%21bad/clicks').expect(400);
  await request(app).put(`/api/cocktails/${id}/clicks`).expect(405);
  const wrongMethod = await request(app).get(`/api/cocktails/${id}/clicks`).expect(405);
  assert.equal(wrongMethod.headers.allow, 'POST');
  assert.deepEqual(recorded, [id, id]);
  fail = true;
  const response = await request(app).post(`/api/cocktails/${id}/clicks`).expect(503);
  assert.equal(response.body.error.code, 'CLICK_UNAVAILABLE');
  assert.deepEqual(recorded, [id, id]);
});

test('事务提交失败不会返回虚假成功', async () => {
  const clicks = createClickRepository({
    collection: () => ({ doc: (id) => id }),
    async runTransaction(callback) {
      await callback({ async get() { return { data: () => null }; }, async set() {} });
      throw new Error('commit failed');
    },
  });
  await assert.rejects(clicks.recordClick(cocktails[0].id), /commit failed/);
});
