import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import ts from 'typescript';
import { XMLParser } from 'fast-xml-parser';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitemapUrl = 'https://iba-world.com/wp-sitemap-posts-iba-cocktail-1.xml';
const dataRoot = path.join(root, 'data/iba-cocktails');
const originalRoot = path.join(dataRoot, 'originals');
const crayonRoot = path.join(dataRoot, 'crayon');
const appRoot = path.join(root, 'miniprogram/assets/cocktails');
const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });
const userAgent = 'CatTavern-IBA-image-import/1.0 (official cocktail image catalog)';

interface SitemapEntry { loc: string }
interface CocktailPage { slug: string; articleUrl: string; originalUrl: string }

function readCatalogIds(): string[] {
  const filename = path.join(root, 'miniprogram/shared/catalog.ts');
  const source = readFileSync(filename, 'utf8');
  const syntax = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  let recipes: ts.ArrayLiteralExpression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'cocktails' && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
      recipes = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(syntax);
  const ids = (recipes?.elements ?? []).flatMap((entry) => {
    if (!ts.isCallExpression(entry) || !entry.arguments[0] || !ts.isObjectLiteralExpression(entry.arguments[0])) return [];
    const property = entry.arguments[0].properties.find((item) => ts.isPropertyAssignment(item)
      && (ts.isIdentifier(item.name) || ts.isStringLiteral(item.name))
      && item.name.text === 'id');
    return property && ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer) ? [property.initializer.text] : [];
  });
  if (!ids.length) throw new Error('无法从共享目录读取鸡尾酒 ID');
  return ids;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.text();
}

async function fetchBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url, { headers: { 'user-agent': userAgent }, signal: AbortSignal.timeout(25_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function withRetry<T>(label: string, operation: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await operation(); } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 350 * attempt));
    }
  }
  throw new Error(`${label}: ${lastError instanceof Error ? lastError.message : 'request failed'}`);
}

function imageFromPage(html: string, slug: string): string {
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  const images = tags.map((tag) => {
    const source = tag.match(/\bsrc\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
    return source?.[1] ?? source?.[2] ?? source?.[3] ?? '';
  }).filter((url) => /^https:\/\/iba-world\.com\/wp-content\/uploads\/.+\/iba-cocktail-[^/?]+\.(?:webp|jpe?g|png)(?:\?.*)?$/i.test(url));

  const exact = images.find((url) => path.basename(new URL(url).pathname).toLowerCase().includes(slug));
  const selected = exact ?? images[0];
  if (!selected) throw new Error(`页面没有找到 IBA 鸡尾酒图片：${slug}`);
  return selected.replace(/&amp;/g, '&');
}

async function getPages(): Promise<CocktailPage[]> {
  const xml = await withRetry('读取 IBA 鸡尾酒 sitemap', () => fetchText(sitemapUrl));
  const document = parser.parse(xml) as { urlset?: { url?: SitemapEntry[] | SitemapEntry } };
  const entries = document.urlset?.url;
  const rows = Array.isArray(entries) ? entries : entries ? [entries] : [];
  const articleUrls = rows.map((entry) => entry.loc).filter((url) => /^https:\/\/iba-world\.com\/iba-cocktail\/[^/]+\/$/.test(url));
  if (!articleUrls.length) throw new Error('IBA sitemap 中没有鸡尾酒页面');

  const pages = new Array<CocktailPage>(articleUrls.length);
  let cursor = 0;
  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= articleUrls.length) return;
      const articleUrl = articleUrls[index];
      const slug = new URL(articleUrl).pathname.split('/').filter(Boolean).at(-1)!;
      const html = await withRetry(`读取 IBA 页面 ${slug}`, () => fetchText(articleUrl));
      pages[index] = { slug, articleUrl, originalUrl: imageFromPage(html, slug) };
      console.info(`已读取官方图片地址 ${index + 1}/${articleUrls.length}: ${slug}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, articleUrls.length) }, worker));
  if (new Set(pages.map((page) => page.slug)).size !== pages.length) throw new Error('IBA sitemap 包含重复鸡尾酒 slug');
  return pages;
}

function hashNoise(x: number, y: number, seed: number): number {
  let value = Math.imul(x ^ seed, 0x45d9f3b) ^ Math.imul(y + seed, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return (value >>> 0) / 0xffffffff;
}

async function makeCrayon(input: Buffer, slug: string): Promise<Buffer> {
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: 540, height: 810, fit: 'inside', withoutEnlargement: true })
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const output = Buffer.alloc(info.width * info.height * 3);
  const gamma = new Uint8Array(256);
  for (let value = 0; value < 256; value++) gamma[value] = Math.min(255, Math.round(255 * (value / 255) ** 0.76));
  const seed = createHash('sha256').update(slug).digest().readUInt32LE(0);
  const width = info.width;
  const height = info.height;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 3;
      const right = (y * width + Math.min(width - 1, x + 1)) * 3;
      const below = (Math.min(height - 1, y + 1) * width + x) * 3;
      const red = gamma[data[offset]];
      const green = gamma[data[offset + 1]];
      const blue = gamma[data[offset + 2]];
      const lum = red * 0.299 + green * 0.587 + blue * 0.114;
      const rightLum = gamma[data[right]] * 0.299 + gamma[data[right + 1]] * 0.587 + gamma[data[right + 2]] * 0.114;
      const belowLum = gamma[data[below]] * 0.299 + gamma[data[below + 1]] * 0.587 + gamma[data[below + 2]] * 0.114;
      const edge = Math.min(42, Math.max(0, Math.abs(lum - rightLum) + Math.abs(lum - belowLum) - 14) * 0.58);
      const grain = (hashNoise(x, y, seed) - 0.5) * 22;
      // 不同尺度的方向噪声模拟蜡笔来回排线，让暗部也能看到纸面和笔触。
      const fiber = (hashNoise(Math.floor((x + y * 0.34) / 5), Math.floor(y / 4), seed ^ 0x5bd1e995) - 0.5) * 34;
      const crosshatch = (hashNoise(Math.floor((x - y * 0.22) / 7), Math.floor((y + x * 0.16) / 6), seed ^ 0x9e3779b9) - 0.5) * 24;
      const mark = grain + fiber + crosshatch - edge;
      const gray = lum;
      for (let channel = 0; channel < 3; channel++) {
        const color = channel === 0 ? red : channel === 1 ? green : blue;
        const saturated = 22 + gray * 0.9 + (color - gray) * 1.08;
        const textured = Math.max(0, Math.min(255, saturated + mark));
        output[offset + channel] = Math.max(0, Math.min(255, Math.round(textured / 12) * 12));
      }
    }
  }
  return sharp(output, { raw: { width, height, channels: 3 } })
    // 处理档案保留 540px；小程序资源在复制时再压到 420px，控制主包体积。
    .webp({ quality: 70, effort: 6 })
    .toBuffer();
}

async function main() {
  await Promise.all([mkdir(originalRoot, { recursive: true }), mkdir(crayonRoot, { recursive: true }), mkdir(appRoot, { recursive: true })]);
  const pages = await getPages();
  const catalogIds = readCatalogIds();
  const downloaded = new Map<string, Buffer>();
  let completed = 0;
  let cursor = 0;

  async function worker() {
    for (;;) {
      const index = cursor++;
      if (index >= pages.length) return;
      const page = pages[index];
      const image = downloaded.get(page.originalUrl) ?? await withRetry(`下载 ${page.slug}`, () => fetchBuffer(page.originalUrl));
      downloaded.set(page.originalUrl, image);
      const originalPath = path.join(originalRoot, `${page.slug}${path.extname(new URL(page.originalUrl).pathname)}`);
      const crayonPath = path.join(crayonRoot, `${page.slug}-crayon.webp`);
      await writeFile(originalPath, image);
      const processed = await makeCrayon(image, page.slug);
      await writeFile(crayonPath, processed);
      completed++;
      console.info(`已生成蜡笔效果 ${completed}/${pages.length}: ${page.slug}`);
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));

  const bySlug = new Map(pages.map((page) => [page.slug, page]));
  const missing = catalogIds.filter((id) => !bySlug.has(id));
  if (missing.length) throw new Error(`当前配方没有找到对应官方页面：${missing.join(', ')}`);
  const sources: Record<string, string> = {};
  for (const id of catalogIds) {
    const page = bySlug.get(id)!;
    sources[id] = page.originalUrl;
    await sharp(path.join(crayonRoot, `${page.slug}-crayon.webp`))
      .resize({ width: 420, height: 630, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 68, effort: 6 })
      .toFile(path.join(appRoot, `${id}-crayon.webp`));
  }
  const sourceModule = `// Generated by npm run iba:images. Do not edit by hand.\nexport const ibaImageSources: Record<string, string> = Object.freeze(${JSON.stringify(sources, null, 2)});\n`;
  await writeFile(path.join(root, 'miniprogram/shared/iba-image-sources.ts'), sourceModule);
  const manifest = pages.map((page) => ({
    slug: page.slug,
    article_url: page.articleUrl,
    original_url: page.originalUrl,
    original_file: `originals/${page.slug}${path.extname(new URL(page.originalUrl).pathname)}`,
    crayon_file: `crayon/${page.slug}-crayon.webp`,
    original_sha256: createHash('sha256').update(downloaded.get(page.originalUrl)!).digest('hex'),
  }));
  await writeFile(path.join(dataRoot, 'manifest.json'), `${JSON.stringify({ source_sitemap: sitemapUrl, generated_at: new Date().toISOString(), filter: 'crayon-v1', cocktails: manifest }, null, 2)}\n`);
  console.info(`完成：${pages.length} 张原图与蜡笔图，${catalogIds.length} 张加入小程序资源，来源清单位于 data/iba-cocktails/manifest.json`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'IBA 图片导入失败');
  process.exitCode = 1;
});
