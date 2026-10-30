import { CATALOG_VERSION, cocktails, ingredients } from './builtin';
import type { Cocktail, Ingredient } from '../../miniprogram/shared/types';
import { isCatalog } from '../../miniprogram/shared/validation';
import { readConfig } from './config';
import { connectDatabase } from './database';

interface SeedDatabase {
  collection(name: string): {
    doc(id: string): {
      set(value: Cocktail | Ingredient): Promise<{ code?: unknown }>;
    };
  };
}

export async function seedCatalog(database: SeedDatabase, onProgress: (message: string) => void = console.info): Promise<void> {
  if (!isCatalog({ version: CATALOG_VERSION, cocktails, ingredients })) {
    throw new Error('内置酒谱未通过校验，停止写入');
  }
  // 用稳定 ID 做 set/upsert；反复执行不会产生重复数据，不删除后台新增酒谱。
  for (const [collection, records] of [['ingredients', ingredients], ['cocktails', cocktails]] as const) {
    for (const record of records) {
      const result = await database.collection(collection).doc(record.id).set(record);
      if (result?.code) throw new Error(`初始化 ${collection}/${record.id} 失败`);
    }
    onProgress(`${collection} 已写入 ${records.length} 条数据`);
  }
  onProgress(`初始化完成，内置数据版本 ${CATALOG_VERSION}`);
}

async function main() {
  const config = readConfig();
  if (!config.envId) throw new Error('初始化数据必须显式配置 CLOUD_BASE_ENV_ID');
  await seedCatalog(connectDatabase(config));
}

// 此文件只通过显式 CLI 运行；HTTP 服务从不加载初始化脚本。
if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : '初始化失败');
    process.exitCode = 1;
  });
}
