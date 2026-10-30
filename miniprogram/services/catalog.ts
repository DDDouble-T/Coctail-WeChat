import { cloudConfig } from '../config';
import { CATALOG_VERSION, cocktails, ingredients } from '../shared/catalog';
import { Catalog } from '../shared/types';
import { isCatalog } from '../shared/validation';

const cacheKey = 'cat-tavern:v1:catalog';
let catalog: Catalog | undefined;
let pending: Promise<boolean> | undefined;

export function getCatalog(): Catalog {
  if (!catalog) {
    catalog = { version: CATALOG_VERSION, cocktails, ingredients };
    // 本地预览固定使用内置酒谱，避免旧云端缓存覆盖测试数据。
    if (!cloudConfig.envId) return catalog;
    try {
      const cached: unknown = wx.getStorageSync(cacheKey);
      if (isCatalog(cached)) catalog = cached;
    } catch { /* 本地内置目录保证离线首屏可用。 */ }
  }
  return catalog;
}

export function refreshCatalog(): Promise<boolean> {
  if (!cloudConfig.envId) return Promise.resolve(true);
  if (pending) return pending;
  pending = fetchCatalog().finally(() => { pending = undefined; });
  return pending;
}

async function fetchCatalog(): Promise<boolean> {
  if (!wx.cloud || !wx.cloud.callContainer) return false;
  try {
    const response = await wx.cloud.callContainer({
      config: { env: cloudConfig.envId },
      path: '/api/catalog',
      method: 'GET',
      header: { 'X-WX-SERVICE': cloudConfig.serviceName },
    });
    const body: unknown = response.data;
    if (response.statusCode !== 200 || typeof body !== 'object' || !body || !('data' in body) || !isCatalog(body.data)) return false;
    catalog = body.data;
    try { wx.setStorageSync(cacheKey, catalog); } catch { /* 配方可在本次会话继续使用。 */ }
    return true;
  } catch {
    return false;
  }
}
