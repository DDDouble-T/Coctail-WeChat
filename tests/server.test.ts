import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import request from 'supertest';
import { cocktails, ingredients } from '../server/src/builtin';
import { createApp } from '../server/src/app';
import { createCatalogRepository } from '../server/src/catalog';
import { readConfig } from '../server/src/config';
import type { CatalogDatabase, CollectionName } from '../server/src/database';
import { seedCatalog } from '../server/src/seed';

function appWith(database?: CatalogDatabase, cacheMs = 30_000) {
  return createApp({ repository: createCatalogRepository(database, cacheMs), onError: () => undefined });
}

function mockDatabase(records: Record<CollectionName, unknown[]> = { cocktails, ingredients }) {
  const calls: Array<{ collection: CollectionName; offset: number; limit: number }> = [];
  const database: CatalogDatabase = {
    async readPage(collection, offset, limit) {
      calls.push({ collection, offset, limit });
      return records[collection].slice(offset, offset + limit);
    },
  };
  return { database, calls };
}

test('本地 API 返回完整内置酒谱，详情有确定的 400/404 行为', async () => {
  const app = appWith();
  const response = await request(app).get('/api/catalog').expect(200);
  assert.equal(response.headers['x-catalog-source'], 'builtin');
  assert.equal(response.body.data.cocktails.length, cocktails.length);
  assert.equal(response.body.data.ingredients.length, ingredients.length);
  const detail = await request(app).get(`/api/cocktails/${cocktails[0].id}`).expect(200);
  assert.deepEqual(detail.body.data, cocktails[0]);
  await request(app).get('/api/cocktails/not-a-real-cocktail').expect(404);
  await request(app).get('/api/cocktails/%21bad').expect(400);
  await request(app).get('/missing-route').expect(404);
});

test('全量蜡笔图及原图经后端返回，禁止读取非图片档案与目录', async () => {
  const app = appWith();
  for (const cocktail of cocktails) {
    for (const url of [cocktail.image_url, cocktail.image_original_url]) {
      const response = await request(app).get(url).expect(200);
      assert.match(response.headers['content-type'], /^image\//);
      assert.match(response.headers['cache-control'], /max-age=86400/);
      const expected = readFileSync(`data/iba-cocktails/${url.replace('/media/cocktails/', '')}`);
      assert.deepEqual(response.body, expected, url);
    }
  }
  await request(app).get('/media/cocktails/manifest.json').expect(404);
  await request(app).get('/media/cocktails/crayon/').expect(404);
  await request(app).get('/media/cocktails/crayon/missing.webp').expect(404);
  await request(app).get('/media/cocktails/crayon/%2e%2e%2fmanifest.json').expect(404);
});

test('云依赖失效时存活探针仍正常，就绪及业务接口明确返回 503', async () => {
  const app = appWith({ async readPage() { throw new Error('模拟数据库网络故障'); } });
  const health = await request(app).get('/healthz').expect(200);
  assert.equal(health.body.mode, 'cloud');
  await request(app).get('/readyz').expect(503);
  const catalog = await request(app).get('/api/catalog').expect(503);
  assert.equal(catalog.body.error.code, 'CATALOG_UNAVAILABLE');
  assert.equal(catalog.body.data, undefined);
  await request(app).get(`/api/cocktails/${cocktails[0].id}`).expect(503);
});

test('TCB 超过 100 条时分页读取两个集合，不截断数据', async () => {
  const manyCocktails = [...cocktails, ...Array.from({ length: 205 - cocktails.length }, (_, index) => ({ ...cocktails[0], id: `recipe-${index}` }))];
  const manyIngredients = [
    ...ingredients,
    ...Array.from({ length: 105 }, (_, index) => ({ ...ingredients[0], id: `extra-ingredient-${index}` })),
  ];
  const { database, calls } = mockDatabase({ cocktails: manyCocktails, ingredients: manyIngredients });
  const response = await request(appWith(database)).get('/api/catalog').expect(200);
  assert.equal(response.body.data.cocktails.length, 205);
  assert.equal(response.body.data.ingredients.length, manyIngredients.length);
  assert.deepEqual(calls.filter((call) => call.collection === 'cocktails').map((call) => call.offset), [0, 100, 200]);
  assert.ok(calls.some((call) => call.collection === 'ingredients' && call.offset === 100));
  assert.equal(response.headers['x-catalog-source'], 'cloud');
});

test('无效、空白或引用断裂的云酒谱不能进入前端', async () => {
  const missingSteps = { ...cocktails[0], steps: undefined };
  const brokenReference = {
    ...cocktails[0],
    ingredients: [{ ...cocktails[0].ingredients[0], ingredient_id: 'missing-ingredient' }],
  };
  for (const records of [
    { cocktails: [missingSteps], ingredients },
    { cocktails: [brokenReference], ingredients },
    { cocktails: [], ingredients: [] },
    { cocktails: cocktails.slice(0, 39), ingredients },
    { cocktails: [cocktails[0], cocktails[0]], ingredients },
  ]) {
    const { database } = mockDatabase(records);
    await request(appWith(database)).get('/api/catalog').expect(503);
  }
});

test('响应仅投影业务字段，数据库元数据和内部字段不会泄露', async () => {
  const { database } = mockDatabase({
    cocktails: cocktails.map((cocktail) => ({ ...cocktail, _id: 'internal-doc', _openid: 'private-openid', internal_note: 'private' })),
    ingredients: ingredients.map((ingredient) => ({ ...ingredient, _id: 'internal-id', internal_cost: 10 })),
  });
  const response = await request(appWith(database)).get('/api/catalog').expect(200);
  const recipe = response.body.data.cocktails[0];
  assert.equal(recipe._id, undefined);
  assert.equal(recipe._openid, undefined);
  assert.equal(recipe.internal_note, undefined);
  assert.equal(response.body.data.ingredients[0].internal_cost, undefined);
});

test('缓存合并并发请求，就绪检查强制刷新，刷新失败使缓存失效', async () => {
  let fail = false;
  const { database, calls } = mockDatabase();
  const repository = createCatalogRepository({
    async readPage(...args) {
      if (fail) throw new Error('数据库不可用');
      return database.readPage(...args);
    },
  });
  const [first, second] = await Promise.all([repository.getCatalog(), repository.getCatalog()]);
  assert.strictEqual(first, second);
  const initialCalls = calls.length;
  await repository.getCatalog();
  assert.equal(calls.length, initialCalls);
  await repository.getCatalog(true);
  assert.equal(calls.length, initialCalls * 2);
  fail = true;
  await assert.rejects(repository.getCatalog(true));
  await assert.rejects(repository.getCatalog());
});

test('云数据变更会改变版本，重复读取不改变版本', async () => {
  const records = { cocktails: cocktails.map((cocktail) => ({ ...cocktail })), ingredients };
  const { database } = mockDatabase(records);
  const repository = createCatalogRepository(database, 0);
  const initial = await repository.getCatalog();
  assert.equal((await repository.getCatalog()).version, initial.version);
  records.cocktails[0].healing_copy += ' 今天也要开心。';
  assert.notEqual((await repository.getCatalog()).version, initial.version);
});

test('只读接口限制方法、异常 JSON 和超大请求内容', async () => {
  const app = appWith();
  await request(app).post('/api/catalog').send({ id: 'try-write' }).expect(405);
  await request(app).get('/api/catalog').set('Content-Type', 'application/json').send('{broken').expect(400);
  await request(app).post('/api/catalog').send({ content: 'x'.repeat(9000) }).expect(413);
  await request(app).get(`/api/catalog?search=${'x'.repeat(2050)}`).expect(414);
});

test('请求限流不会被客户端自填 OPENID 或转发头绕过，探针不参与限流', async () => {
  const app = createApp({ repository: createCatalogRepository(), rateLimitMax: 2, onError: () => undefined });
  await request(app).get('/api/catalog').set('X-WX-OPENID', 'attacker-one').expect(200);
  await request(app).get('/api/catalog').set('X-WX-OPENID', 'attacker-two').expect(200);
  await request(app).get('/api/catalog').set('X-Forwarded-For', '203.0.113.1').expect(429);
  await request(app).get('/healthz').expect(200);
});

test('生产环境缺少环境 ID 或凭证只配置一半时拒绝启动', () => {
  assert.throws(() => readConfig({ NODE_ENV: 'production' }), /CLOUD_BASE_ENV_ID/);
  assert.throws(() => readConfig({ TENCENTCLOUD_SECRETID: 'partial' }), /必须同时配置/);
  assert.throws(() => readConfig({ PORT: 'NaN' }), /PORT/);
  assert.throws(() => readConfig({ TRUST_PROXY_HOPS: '100' }), /TRUST_PROXY_HOPS/);
  assert.equal(readConfig({}).envId, '');
  assert.equal(readConfig({ PORT: '80', CLOUD_BASE_ENV_ID: 'cloud1-test' }).port, 80);
  assert.equal(readConfig({ CLOUDBASE_APIKEY: ' server-api-key ' }).accessKey, 'server-api-key');
});

test('初始化按稳定 ID 幂等覆写，保留额外记录且写入失败时拒绝成功', async () => {
  const documents = new Map<string, unknown>([['cocktails/custom-recipe', { id: 'custom-recipe' }]]);
  const database = {
    collection(collection: string) {
      return {
        doc(id: string) {
          return {
            async set(value: unknown) {
              documents.set(`${collection}/${id}`, value);
              return {};
            },
          };
        },
      };
    },
  };
  await seedCatalog(database, () => undefined);
  await seedCatalog(database, () => undefined);
  assert.equal(documents.size, cocktails.length + ingredients.length + 1);
  assert.ok(documents.has('cocktails/custom-recipe'));
  assert.deepEqual(documents.get(`cocktails/${cocktails[0].id}`), cocktails[0]);
  const rejectedDatabase = {
    collection() {
      return { doc() { return { async set() { return { code: 'PERMISSION_DENIED' }; } }; } };
    },
  };
  await assert.rejects(seedCatalog(rejectedDatabase, () => undefined), /初始化/);
});
