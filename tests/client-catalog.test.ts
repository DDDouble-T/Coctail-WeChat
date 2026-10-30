import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import type { Catalog } from '../miniprogram/shared/types';

type WxMock = Record<string, any>;
const root = process.cwd();
const snapshot = JSON.parse(readFileSync(path.join(root, 'server/data/catalog.json'), 'utf8')) as Catalog;
const imagePath = snapshot.cocktails[0].image_url;
const cacheKey = 'cat-tavern:v2:catalog:paw-inn-d9gixxkg3f894407e:paw-inn';

// 每个场景独立装载小程序模块，模拟应用重启及微信 API，而不共享服务单例。
function client(wx: WxMock, page?: (options: any) => void) {
  const modules = new Map<string, { exports: any }>();
  function load(relative: string, directory = root): any {
    const filename = path.resolve(directory, relative.endsWith('.ts') ? relative : `${relative}.ts`);
    const existing = modules.get(filename);
    if (existing) return existing.exports;
    const module = { exports: {} };
    modules.set(filename, module);
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    }).outputText;
    const execute = new Function('require', 'module', 'exports', 'wx', 'Page', compiled);
    execute((name: string) => load(name, path.dirname(filename)), module, module.exports, wx, page);
    return module.exports;
  }
  return (file: string) => load(file);
}

function catalogMock(cached?: unknown) {
  const storage = new Map<string, unknown>();
  if (cached !== undefined) storage.set(cacheKey, cached);
  const requests: any[] = [];
  const wx: WxMock = {
    getStorageSync: (key: string) => storage.get(key),
    setStorageSync: (key: string, value: unknown) => storage.set(key, value),
    cloud: { callContainer: async (request: any) => { requests.push(request); return { statusCode: 200, data: { data: snapshot } }; } },
  };
  return { wx, storage, requests };
}

test('冷启动不使用旧 39 杯缓存，首次成功后加载全量后端目录并复用在途请求', async () => {
  const { wx, storage, requests } = catalogMock();
  storage.set('cat-tavern:v1:catalog', snapshot);
  const service = client(wx)('miniprogram/services/catalog');
  assert.deepEqual(service.getCatalog(), { version: '', cocktails: [], ingredients: [] });
  assert.match(service.catalogFailureNotice(), /加载失败/);
  const first = service.refreshCatalog();
  assert.equal(first, service.refreshCatalog());
  assert.equal(await first, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].path, '/api/catalog');
  assert.equal(requests[0].header['X-WX-SERVICE'], 'paw-inn');
  assert.equal(service.getCatalog().cocktails.length, snapshot.cocktails.length);
  assert.deepEqual(storage.get(cacheKey), snapshot);
});

test('仅恢复校验有效的后端缓存，失败与无效响应保留已有酒谱，重试可恢复', async () => {
  const { wx } = catalogMock(snapshot);
  const service = client(wx)('miniprogram/services/catalog');
  assert.equal(service.getCatalog().cocktails.length, snapshot.cocktails.length);
  wx.cloud.callContainer = async () => { throw new Error('offline'); };
  assert.equal(await service.refreshCatalog(), false);
  assert.match(service.catalogFailureNotice(), /上次加载/);
  assert.deepEqual(service.getCatalog(), snapshot);
  wx.cloud.callContainer = async () => ({ statusCode: 200, data: { data: { ...snapshot, ingredients: [] } } });
  assert.equal(await service.refreshCatalog(), false);
  assert.deepEqual(service.getCatalog(), snapshot);
  wx.cloud.callContainer = async () => ({ statusCode: 503, data: { data: snapshot } });
  assert.equal(await service.refreshCatalog(), false);
  wx.cloud.callContainer = async () => ({ statusCode: 200, data: { data: snapshot } });
  assert.equal(await service.refreshCatalog(), true);
});

test('损坏缓存、非后端图片和持久化失败均有安全的加载行为', async () => {
  const bad = structuredClone(snapshot);
  bad.cocktails[0].image_url = 'https://untrusted.example/cocktail.webp';
  const { wx } = catalogMock(bad);
  const service = client(wx)('miniprogram/services/catalog');
  assert.equal(service.getCatalog().cocktails.length, 0);
  wx.setStorageSync = () => { throw new Error('disk full'); };
  assert.equal(await service.refreshCatalog(), true);
  assert.equal(service.getCatalog().cocktails.length, snapshot.cocktails.length);
  wx.cloud = undefined;
  assert.equal(await service.refreshCatalog(), false);
});

test('首次直接打开详情时等待网络结果，成功后重绘酒谱，离线失败可重试', async () => {
  const { wx } = catalogMock();
  let resolve: (value: unknown) => void = () => {};
  wx.cloud.callContainer = () => new Promise((done) => { resolve = done; });
  wx.setNavigationBarTitle = () => {};
  let page: any;
  client(wx, (options) => {
    page = { ...options, data: structuredClone(options.data), setData(update: unknown) { Object.assign(this.data, update); } };
  })('miniprogram/pages/detail/index');
  page.onLoad({ id: snapshot.cocktails[0].id });
  assert.equal(page.data.loading, true);
  assert.equal(page.data.recipe, null);
  resolve({ statusCode: 200, data: { data: snapshot } });
  await new Promise((done) => setImmediate(done));
  assert.equal(page.data.loading, false);
  assert.equal(page.data.found, true);
  assert.equal(page.data.recipe.id, snapshot.cocktails[0].id);
  wx.cloud.callContainer = async () => { throw new Error('offline'); };
  await page.sync();
  assert.equal(page.data.recipe.id, snapshot.cocktails[0].id);
  assert.match(page.data.notice, /重试/);
});

function imageMock() {
  const files = new Map<string, { data: ArrayBuffer; time: number }>();
  const requests: any[] = [];
  const validImage = new Uint8Array([82, 73, 70, 70, 4, 0, 0, 0, 87, 69, 66, 80]).buffer;
  let time = 0;
  const fs = {
    mkdirSync() {},
    statSync(filename: string) {
      const file = files.get(filename);
      if (!file) throw new Error('ENOENT');
      return { size: file.data.byteLength, lastModifiedTime: file.time, isFile: () => true };
    },
    readdirSync(directory: string) { return [...files.keys()].filter((name) => name.startsWith(`${directory}/`)).map((name) => name.slice(directory.length + 1)); },
    unlinkSync(filename: string) { files.delete(filename); },
    writeFileSync(filename: string, data: ArrayBuffer) { files.set(filename, { data, time: ++time }); },
  };
  const wx: WxMock = {
    env: { USER_DATA_PATH: '/user-data' }, getFileSystemManager: () => fs,
    cloud: { callContainer: async (request: any) => { requests.push(request); return { statusCode: 200, data: validImage }; } },
  };
  return { wx, fs, files, requests, validImage };
}

test('图片经云托管二进制下载并去重、落盘复用，目录版本变化使旧图失效', async () => {
  const { wx, files, requests } = imageMock();
  const images = client(wx)('miniprogram/services/images');
  const first = images.loadImage(imagePath, 'one');
  assert.equal(first, images.loadImage(imagePath, 'one'));
  const filename = await first;
  assert.match(filename, /^\/user-data\/cat-tavern-images-v2\//);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].responseType, 'arraybuffer');
  assert.equal(requests[0].header['X-WX-SERVICE'], 'paw-inn');
  assert.ok(files.has(filename));
  assert.equal(await images.loadImage(imagePath, 'one'), filename);
  assert.equal(requests.length, 1);
  const cloud = wx.cloud;
  wx.cloud = undefined;
  assert.equal(await images.loadImage(imagePath, 'one'), filename);
  wx.cloud = cloud;
  const updated = await images.loadImage(imagePath, 'two');
  assert.notEqual(updated, filename);
  assert.equal(requests.length, 2);
  images.invalidateImage(imagePath, 'two');
  assert.equal(files.has(updated), false);
});

test('图片请求并发最多三个，失败后可重试，并拒绝任意URL、HTML及超大响应', async () => {
  const { wx, files, validImage } = imageMock();
  const images = client(wx)('miniprogram/services/images');
  let active = 0;
  let maximum = 0;
  wx.cloud.callContainer = async () => {
    maximum = Math.max(maximum, ++active);
    await new Promise((done) => setImmediate(done));
    active--;
    return { statusCode: 200, data: validImage };
  };
  const paths = snapshot.cocktails.slice(0, 8).map((entry) => entry.image_url);
  assert.ok((await Promise.all(paths.map((value) => images.loadImage(value, 'v1')))).every(Boolean));
  assert.equal(maximum, 3);
  assert.equal(await images.loadImage('/media/cocktails/../secret', 'v1'), '');
  assert.equal(await images.loadImage('https://iba-world.com/image.webp', 'v1'), '');
  wx.cloud.callContainer = async () => { throw new Error('timeout'); };
  assert.equal(await images.loadImage(imagePath, 'failure'), '');
  wx.cloud.callContainer = async () => ({ statusCode: 200, data: new TextEncoder().encode('<html>error</html>').buffer });
  assert.equal(await images.loadImage(imagePath, 'failure'), '');
  wx.cloud.callContainer = async () => ({ statusCode: 200, data: new ArrayBuffer(4 * 1024 * 1024 + 1) });
  assert.equal(await images.loadImage(imagePath, 'failure'), '');
  wx.cloud.callContainer = async () => ({ statusCode: 200, data: validImage });
  assert.ok(await images.loadImage(imagePath, 'failure'));
  assert.equal(files.size, 9);
});

test('图片缓存限制在16MiB以内，自动淘汰旧文件而不触碰其他目录', async () => {
  const { wx, files, validImage } = imageMock();
  const large = new Uint8Array(4 * 1024 * 1024);
  large.set(new Uint8Array(validImage));
  wx.cloud.callContainer = async () => ({ statusCode: 200, data: large.buffer });
  files.set('/user-data/other-app/keep.webp', { data: validImage, time: 0 });
  const images = client(wx)('miniprogram/services/images');
  for (const recipe of snapshot.cocktails.slice(0, 6)) assert.ok(await images.loadImage(recipe.image_url, 'v1'));
  assert.equal(files.size, 5);
  assert.ok(files.has('/user-data/other-app/keep.webp'));
  const cachedBytes = [...files.entries()].filter(([name]) => name.includes('/cat-tavern-images-v2/')).reduce((sum, [, file]) => sum + file.data.byteLength, 0);
  assert.equal(cachedBytes, 16 * 1024 * 1024);
});
