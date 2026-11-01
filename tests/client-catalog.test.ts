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
function client(wx: WxMock, page?: (options: any) => void, logger: Pick<Console, 'error'> = { error() {} }, component?: (options: any) => void) {
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
    const execute = new Function('require', 'module', 'exports', 'wx', 'Page', 'console', 'Component', compiled);
    execute((name: string) => load(name, path.dirname(filename)), module, module.exports, wx, page, logger, component);
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

test('卡片成功导航后才上报点击，失败不重试且不影响浏览', async () => {
  const { wx, requests } = catalogMock();
  let navigation: any;
  wx.navigateTo = (options: any) => { navigation = options; };
  const service = client(wx)('miniprogram/services/clicks');
  service.openRecipe(snapshot.cocktails[0].id);
  assert.equal(navigation.url, `/pages/detail/index?id=${snapshot.cocktails[0].id}`);
  assert.equal(requests.length, 0);
  navigation.success();
  await new Promise((done) => setImmediate(done));
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'POST');
  assert.equal(requests[0].path, `/api/cocktails/${snapshot.cocktails[0].id}/clicks`);
  assert.equal(requests[0].header['X-WX-SERVICE'], 'paw-inn');
  let failures = 0;
  wx.cloud.callContainer = async () => { failures++; throw new Error('offline'); };
  service.openRecipe(snapshot.cocktails[0].id);
  navigation.success();
  await new Promise((done) => setImmediate(done));
  assert.equal(failures, 1);
  wx.cloud = undefined;
  service.openRecipe(snapshot.cocktails[0].id);
  assert.doesNotThrow(() => navigation.success());
});

test('普通卡片和今日特调都接入点击统计，页面重绘不会上报', async () => {
  const { wx, requests } = catalogMock(snapshot);
  const navigations: any[] = [];
  wx.navigateTo = (options: any) => { navigations.push(options); options.success(); };
  let page: any;
  let component: any;
  const load = client(wx, (options) => {
    page = { ...options, data: structuredClone(options.data), setData(update: unknown) { Object.assign(this.data, update); } };
  }, undefined, (options) => {
    component = { data: { card: { id: snapshot.cocktails[0].id } }, ...options.methods };
  });
  load('miniprogram/components/recipe-card/index');
  load('miniprogram/pages/home/index');
  page.render();
  page.render();
  assert.equal(requests.length, 0);
  component.open();
  page.openDaily();
  await new Promise((done) => setImmediate(done));
  assert.equal(navigations.length, 2);
  assert.equal(requests.length, 2);
  assert.ok(requests.every((entry) => entry.method === 'POST' && entry.path.endsWith('/clicks')));
});

test('首页搜索从全部分类开始，分类 tab 展示各自的命中结果', () => {
  const { wx } = catalogMock(snapshot);
  let page: any;
  client(wx, (options) => {
    page = { ...options, data: structuredClone(options.data), setData(update: unknown) { Object.assign(this.data, update); } };
  })('miniprogram/pages/home/index');
  const select = (id: string) => page.selectFamily({ currentTarget: { dataset: { id } } });
  select('sour');
  assert.ok(page.data.cards.length > 0);
  assert.ok(page.data.cards.every((card: any) => snapshot.cocktails.find((recipe) => recipe.id === card.id)?.family === 'sour'));
  page.search({ detail: { value: 'Negroni' } });
  assert.equal(page.data.selectedFamily, 'all');
  assert.deepEqual(page.data.cards.map((card: any) => card.id), ['negroni']);
  select('fizz');
  assert.equal(page.data.cards.length, 0);
  assert.equal(page.data.query, 'Negroni');
  select(snapshot.cocktails.find((recipe) => recipe.id === 'negroni')!.family);
  assert.deepEqual(page.data.cards.map((card: any) => card.id), ['negroni']);
  page.search({ detail: { value: '金酒' } });
  assert.equal(page.data.selectedFamily, 'all');
  const allSearchIds = page.data.cards.map((card: any) => card.id);
  assert.ok(allSearchIds.includes('negroni'));
  select('fizz');
  const fizzSearchIds = allSearchIds.filter((id: string) => snapshot.cocktails.find((recipe) => recipe.id === id)?.family === 'fizz');
  assert.ok(fizzSearchIds.length > 0);
  assert.ok(fizzSearchIds.length < allSearchIds.length);
  assert.deepEqual(page.data.cards.map((card: any) => card.id), fizzSearchIds);
  assert.equal(page.data.query, '金酒');
  select('all');
  assert.deepEqual(page.data.cards.map((card: any) => card.id), allSearchIds);
  select('fizz');
  page.clearSearch();
  assert.equal(page.data.selectedFamily, 'fizz');
  assert.ok(page.data.cards.length > 0);
  assert.ok(page.data.cards.every((card: any) => snapshot.cocktails.find((recipe) => recipe.id === card.id)?.family === 'fizz'));
  page.search({ detail: { value: '不存在的酒款' } });
  assert.equal(page.data.cards.length, 0);
  page.showAll();
  assert.equal(page.data.query, '');
  assert.equal(page.data.selectedFamily, 'all');
  assert.equal(page.data.cards.length, snapshot.cocktails.length);
});

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

test('接口失败保留微信错误码，并区分 HTTP 错误和响应校验失败，不记录完整响应或凭证', async () => {
  const { wx } = catalogMock(snapshot);
  const logs: unknown[][] = [];
  const service = client(wx, undefined, { error: (...args) => logs.push(args) })('miniprogram/services/catalog');
  wx.cloud.callContainer = async () => { throw { errCode: -501000, errMsg: 'invalid env', authorization: 'private-value' }; };
  assert.equal(await service.refreshCatalog(), false);
  assert.equal((logs[0][1] as any).errCode, -501000);
  assert.equal((logs[0][1] as any).errMsg, 'invalid env');
  wx.cloud.callContainer = async () => ({ statusCode: 403, data: { private: 'private-value' } });
  assert.equal(await service.refreshCatalog(), false);
  assert.equal((logs[1][1] as any).statusCode, 403);
  wx.cloud.callContainer = async () => ({ statusCode: 200, data: 'unexpected text' });
  assert.equal(await service.refreshCatalog(), false);
  assert.equal((logs[2][1] as any).dataType, 'string');
  assert.doesNotMatch(JSON.stringify(logs), /private-value/);
  assert.deepEqual(service.getCatalog(), snapshot);
});

for (const name of ['home', 'bar', 'collection']) {
  test(`${name} 页首次 onShow 在目录返回前安全渲染，网络成功后恢复酒谱和原有材料`, async () => {
    const { wx, storage } = catalogMock();
    storage.set('cat-tavern:v1:bar', ['Gin', '不存在的材料']);
    storage.set('cat-tavern:v1:favorites', [snapshot.cocktails[0].id]);
    // 旧版本的缓存结构不能作为尚未获取的远端目录使用。
    storage.set('cat-tavern:v1:catalog', { cocktails: snapshot.cocktails.slice(0, 39) });
    let resolve: (value: unknown) => void = () => {};
    wx.cloud.callContainer = () => new Promise((done) => { resolve = done; });
    let page: any;
    const load = client(wx, (options) => {
      page = { ...options, data: structuredClone(options.data), setData(update: unknown) { Object.assign(this.data, update); } };
    });
    load(`miniprogram/pages/${name}/index`);
    assert.doesNotThrow(() => page.onShow());
    assert.equal(page.data.loading, true);
    assert.equal(page.data.total, 0);
    assert.deepEqual(page.data.cards, []);
    resolve({ statusCode: 200, data: { data: snapshot } });
    await new Promise((done) => setImmediate(done));
    assert.equal(page.data.loading, false);
    assert.equal(page.data.total, snapshot.cocktails.length);
    assert.equal(page.data.notice, '');
    assert.ok(page.data.cards.length > 0);
    assert.deepEqual(storage.get('cat-tavern:v1:bar'), ['Gin', '不存在的材料']);
    if (name === 'bar') assert.deepEqual(page.data.selected, [{ id: 'gin', name: '金酒' }]);
    if (name === 'home') assert.ok(page.data.daily.id);
    if (name === 'collection') assert.equal(page.data.cards[0].id, snapshot.cocktails[0].id);
  });

  test(`${name} 页在目录缺失且接口失败时显示重试，重试成功后可正常使用`, async () => {
    const { wx } = catalogMock({ version: 'broken', cocktails: [] });
    wx.cloud.callContainer = async () => { throw new Error('offline'); };
    let page: any;
    client(wx, (options) => {
      page = { ...options, data: structuredClone(options.data), setData(update: unknown) { Object.assign(this.data, update); } };
    })(`miniprogram/pages/${name}/index`);
    assert.doesNotThrow(() => page.onShow());
    await new Promise((done) => setImmediate(done));
    assert.equal(page.data.loading, false);
    assert.equal(page.data.total, 0);
    assert.match(page.data.notice, /重试/);
    wx.cloud.callContainer = async () => ({ statusCode: 200, data: { data: snapshot } });
    await page.sync();
    assert.equal(page.data.total, snapshot.cocktails.length);
    assert.equal(page.data.notice, '');
  });
}

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

test('图片组件重复接收相同属性时保留画面和在途请求，换图或版本变化时更新', async () => {
  const { wx, requests } = imageMock();
  const updates: any[] = [];
  let component: any;
  let observe: () => void;
  client(wx, undefined, undefined, (options) => {
    component = {
      data: structuredClone(options.data),
      properties: { path: imagePath, version: 'one' },
      ...options.methods,
      setData(update: any) { updates.push(update); Object.assign(this.data, update); },
    };
    observe = () => options.observers['path, version'].call(component, component.properties.path, component.properties.version);
  })('miniprogram/components/cocktail-image/index');
  observe!();
  component.data.visible = true;
  await component.load();
  const firstPath = component.data.localPath;
  assert.ok(firstPath);
  updates.length = 0;
  observe!();
  observe!();
  assert.equal(updates.length, 0);
  assert.equal(component.data.localPath, firstPath);
  assert.equal(requests.length, 1);

  component.properties.version = 'two';
  observe!();
  assert.equal(component.data.localPath, '');
  const requestId = component.data.requestId;
  observe!();
  assert.equal(component.data.requestId, requestId);
  await new Promise((done) => setImmediate(done));
  assert.ok(component.data.localPath);
  assert.notEqual(component.data.localPath, firstPath);
  assert.equal(requests.length, 2);

  component.properties.path = snapshot.cocktails[1].image_original_url;
  observe!();
  await new Promise((done) => setImmediate(done));
  assert.ok(component.data.localPath);
  assert.equal(requests.length, 3);
  assert.equal(requests[2].path, component.properties.path);
});

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
