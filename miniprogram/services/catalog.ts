import { cloudConfig } from '../config';
import { Catalog } from '../shared/types';
import { isCatalog } from '../shared/validation';

// 独立命名空间使旧版 39 杯内置配方的缓存失效，也避免串用其他云环境。
const cacheKey = `cat-tavern:v2:catalog:${cloudConfig.envId}:${cloudConfig.serviceName}`;
let catalog: Catalog | undefined;
let pending: Promise<boolean> | undefined;

export function getCatalog(): Catalog {
  if (!catalog) {
    catalog = { version: '', cocktails: [], ingredients: [] };
    try {
      const cached: unknown = wx.getStorageSync(cacheKey);
      if (isCatalog(cached)) catalog = cached;
    } catch { /* 缓存不可读时，由接口重新加载。 */ }
  }
  return catalog;
}

export function catalogFailureNotice(): string {
  return getCatalog().cocktails.length
    ? '酒单更新失败，正在显示上次加载的配方。点此重试。'
    : '酒单加载失败，请检查网络后点此重试。';
}

export function refreshCatalog(): Promise<boolean> {
  if (pending) return pending;
  pending = fetchCatalog().finally(() => { pending = undefined; });
  return pending;
}

async function fetchCatalog(): Promise<boolean> {
  if (!cloudConfig.envId || !wx.cloud || !wx.cloud.callContainer) {
    console.error('[catalog] 云托管调用不可用', { envId: cloudConfig.envId, serviceName: cloudConfig.serviceName });
    return false;
  }
  try {
    const response = await wx.cloud.callContainer({
      config: { env: cloudConfig.envId }, path: '/api/catalog', method: 'GET', timeout: 20_000,
      header: { 'X-WX-SERVICE': cloudConfig.serviceName },
    });
    const body: unknown = response.data;
    if (response.statusCode !== 200) {
      console.error('[catalog] 云托管返回异常状态', { statusCode: response.statusCode });
      return false;
    }
    if (typeof body !== 'object' || !body || !('data' in body) || !isCatalog(body.data)) {
      console.error('[catalog] 酒单响应校验失败', { dataType: typeof body });
      return false;
    }
    catalog = body.data;
    try { wx.setStorageSync(cacheKey, catalog); } catch { /* 存储空间不足不影响本次会话。 */ }
    return true;
  } catch (error) {
    // 只记录定位网关错误所需的字段，避免将完整响应或请求凭证写入控制台。
    const detail = error as { errCode?: unknown; errMsg?: unknown; message?: unknown } | null;
    console.error('[catalog] 云托管调用失败', {
      envId: cloudConfig.envId, serviceName: cloudConfig.serviceName,
      errCode: detail?.errCode, errMsg: detail?.errMsg, message: detail?.message,
    });
    return false;
  }
}
