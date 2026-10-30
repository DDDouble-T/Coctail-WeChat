import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';

const base = (process.env.API_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const expectedSource = process.env.EXPECTED_CATALOG_SOURCE || 'cloud';
const snapshot = JSON.parse(await readFile(new URL('../server/data/catalog.json', import.meta.url), 'utf8'));
async function get(route) {
  const response = await fetch(`${base}${route}`, { signal: AbortSignal.timeout(20_000) });
  assert.equal(response.status, 200, `${route} 返回 ${response.status}`);
  return response;
}

for (let attempt = 0; ; attempt++) {
  try { await get('/healthz'); break; } catch (error) {
    if (attempt >= 20) throw error;
    await setTimeout(1000);
  }
}
assert.equal((await (await get('/readyz')).json()).mode, expectedSource);
const response = await get('/api/catalog');
assert.equal(response.headers.get('x-catalog-source'), expectedSource);
const { data } = await response.json();
const actualIds = new Set(data.cocktails.map((cocktail) => cocktail.id));
for (const cocktail of snapshot.cocktails) assert.ok(actualIds.has(cocktail.id), `缺少 ${cocktail.id}`);
const detail = await (await get(`/api/cocktails/${snapshot.cocktails[0].id}`)).json();
assert.equal(detail.data.id, snapshot.cocktails[0].id);
for (const route of [detail.data.image_url, detail.data.image_original_url]) {
  const image = await get(route);
  assert.match(image.headers.get('content-type') || '', /^image\//);
  assert.ok((await image.arrayBuffer()).byteLength > 100, `${route} 图片为空`);
}
console.info(`验证通过：${expectedSource} 数据源、${data.cocktails.length} 款酒谱、${data.ingredients.length} 种原料、详情与后端图片`);
