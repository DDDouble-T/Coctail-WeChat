import { cloudConfig } from '../config';

const maxCacheBytes = 16 * 1024 * 1024;
const maxImageBytes = 4 * 1024 * 1024;
const maxConcurrent = 3;
const pending = new Map<string, Promise<string>>();
const queue: Array<() => void> = [];
let active = 0;

// 目录版本、环境及服务均参与缓存键，后端换图后不会继续使用旧文件。
function cachePath(mediaPath: string, version: string): string {
  let hash = 2166136261;
  for (const character of `${cloudConfig.envId}:${cloudConfig.serviceName}:${version}`) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
  }
  return `${wx.env.USER_DATA_PATH}/cat-tavern-images-v2/${hash.toString(16)}-${mediaPath.replace('/media/cocktails/', '').replace('/', '-')}`;
}

function isMediaPath(value: string): boolean {
  return /^\/media\/cocktails\/(?:crayon\/[a-z0-9][a-z0-9_-]{0,79}-crayon\.webp|originals\/[a-z0-9][a-z0-9_-]{0,79}\.(?:webp|jpe?g|png))$/.test(value);
}

function cachedFile(filename: string): boolean {
  try {
    const stat = wx.getFileSystemManager().statSync(filename);
    return !Array.isArray(stat) && stat.isFile() && stat.size > 0 && stat.size <= maxImageBytes;
  } catch { return false; }
}

async function withSlot<T>(operation: () => Promise<T>): Promise<T> {
  if (active >= maxConcurrent) await new Promise<void>((resolve) => queue.push(resolve));
  else active++;
  try { return await operation(); } finally {
    const next = queue.shift();
    if (next) next();
    else active--;
  }
}

function reserveSpace(bytes: number): void {
  const fs = wx.getFileSystemManager();
  const directory = `${wx.env.USER_DATA_PATH}/cat-tavern-images-v2`;
  try { fs.mkdirSync(directory, true); } catch { /* 已存在时继续读取；其他错误由调用方统一处理。 */ }
  const files = fs.readdirSync(directory).flatMap((name) => {
    const filename = `${directory}/${name}`;
    try {
      const stat = fs.statSync(filename);
      return !Array.isArray(stat) && stat.isFile() ? [{ filename, size: stat.size, time: stat.lastModifiedTime }] : [];
    } catch { return []; }
  }).sort((left, right) => left.time - right.time);
  let total = files.reduce((sum, file) => sum + file.size, 0);
  for (const file of files) {
    if (total + bytes <= maxCacheBytes) break;
    fs.unlinkSync(file.filename);
    total -= file.size;
  }
}

function isImage(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
  return (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    || (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    || (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50);
}

export function invalidateImage(mediaPath: string, version: string): void {
  if (!isMediaPath(mediaPath)) return;
  try { wx.getFileSystemManager().unlinkSync(cachePath(mediaPath, version)); } catch { /* 文件可能已被缓存清理。 */ }
}

export function loadImage(mediaPath: string, version: string): Promise<string> {
  if (!isMediaPath(mediaPath) || !version) return Promise.resolve('');
  const filename = cachePath(mediaPath, version);
  if (cachedFile(filename)) return Promise.resolve(filename);
  if (!wx.cloud?.callContainer) return Promise.resolve('');
  const current = pending.get(filename);
  if (current) return current;
  const request = withSlot(async () => {
    try {
      const response = await wx.cloud.callContainer({
        config: { env: cloudConfig.envId }, path: mediaPath, method: 'GET',
        header: { 'X-WX-SERVICE': cloudConfig.serviceName },
        dataType: 'other', responseType: 'arraybuffer', timeout: 20_000,
      });
      const body: unknown = response.data;
      if (response.statusCode !== 200 || !(body instanceof ArrayBuffer) || body.byteLength === 0 || body.byteLength > maxImageBytes || !isImage(body)) return '';
      // 同步写入让容量检查与落盘不可交错，避免多个下载同时突破缓存上限。
      reserveSpace(body.byteLength);
      wx.getFileSystemManager().writeFileSync(filename, body);
      return filename;
    } catch { return ''; }
  }).finally(() => pending.delete(filename));
  pending.set(filename, request);
  return request;
}
