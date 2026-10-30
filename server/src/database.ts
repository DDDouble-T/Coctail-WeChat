import cloudbase from '@cloudbase/node-sdk';
import type { ServerConfig } from './config';

export type CollectionName = 'cocktails' | 'ingredients';

export interface CatalogDatabase {
  readPage(collection: CollectionName, offset: number, limit: number): Promise<unknown[]>;
}

export function connectDatabase(config: ServerConfig) {
  if (!config.envId) throw new Error('访问 TCB 必须指定 CLOUD_BASE_ENV_ID');
  return cloudbase.init({
    env: config.envId,
    // 普通云托管容器没有函数临时身份；显式传服务端 API Key，避免 SDK 版本的环境读取差异。
    accessKey: config.accessKey,
    region: config.region,
    secretId: config.secretId,
    secretKey: config.secretKey,
    sessionToken: config.sessionToken,
    timeout: 8000,
  }).database();
}

export function createCatalogDatabase(config: ServerConfig): CatalogDatabase {
  const database = connectDatabase(config);
  return {
    async readPage(collection, offset, limit) {
      const result = await database.collection(collection)
        .orderBy('_id', 'asc').skip(offset).limit(limit).get();
      // SDK 除抛异常外，也可能在返回值里携带错误码，不能将其视为空集合。
      if (('code' in result && result.code) || !Array.isArray(result.data)) {
        throw new Error(`读取 ${collection} 失败`);
      }
      return result.data as unknown[];
    },
  };
}
