import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sass from 'sass';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mini = path.join(root, 'miniprogram');
const readJson = async (file) => JSON.parse(await readFile(path.join(mini, file), 'utf8'));
const app = await readJson('app.json');
const requiredPages = ['pages/home/index', 'pages/bar/index', 'pages/detail/index', 'pages/collection/index'];
if (JSON.stringify(app.pages) !== JSON.stringify(requiredPages)) throw new Error('app.json 页面清单与 MVP 不一致');
if (!Array.isArray(app.tabBar?.list) || app.tabBar.list.length !== 2) throw new Error('底部导航必须正好有两个 Tab');
if (app.tabBar.list[0].text !== '调酒配方' || app.tabBar.list[1].text !== '我的酒吧') throw new Error('底部导航文案必须是调酒配方 / 我的酒吧');

const assetPaths = new Set();
for (const item of app.tabBar.list) {
  assetPaths.add(item.iconPath);
  assetPaths.add(item.selectedIconPath);
}
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await walk(full);
    else if (entry.name.endsWith('.wxml')) {
      const source = await readFile(full, 'utf8');
      for (const match of source.matchAll(/(?:src|iconPath|selectedIconPath)="\/??(assets\/[^"]+)"/g)) assetPaths.add(match[1]);
    }
  }
}
await walk(mini);
for (const asset of assetPaths) {
  try { await readFile(path.join(mini, asset)); } catch { throw new Error(`WXML 引用了不存在的资源：${asset}`); }
}

const styleFiles = [];
async function collectStyles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) await collectStyles(full);
    else if (entry.name.endsWith('.scss')) styleFiles.push(full);
  }
}
await collectStyles(mini);
for (const file of styleFiles) sass.compile(file, { style: 'compressed' });
console.log(`小程序模板检查通过：${requiredPages.length} 个页面、${assetPaths.size} 个资源引用、${styleFiles.length} 个 Sass 文件`);
