export interface ClickRepository {
  recordClick(id: string): Promise<void>;
}

interface StatsDocument {
  id: string;
  click_count: number;
  last_clicked_at: string;
}

// 最小事务接口便于验证首次写入及失败路径，具体连接由 CloudBase SDK 提供。
interface StatsDatabase {
  collection(name: string): { doc(id: string): unknown };
  runTransaction(callback: (transaction: {
    get(document: unknown): Promise<{ data(): StatsDocument | null | undefined }>;
    set(document: unknown, data: StatsDocument): Promise<unknown>;
  }) => Promise<void>): Promise<void>;
}

export function createClickRepository(database?: StatsDatabase): ClickRepository {
  const counts = new Map<string, number>();
  return {
    async recordClick(id) {
      if (!database) {
        counts.set(id, (counts.get(id) || 0) + 1);
        return;
      }
      const document = database.collection('cocktail_stats').doc(id);
      // 首次创建和后续累加使用同一事务，避免多实例并发时丢失点击。
      await database.runTransaction(async (transaction) => {
        const previous = (await transaction.get(document)).data();
        const count = previous?.click_count ?? 0;
        if (!Number.isSafeInteger(count) || count < 0 || count >= Number.MAX_SAFE_INTEGER) {
          throw new Error('点击统计数据无效');
        }
        await transaction.set(document, {
          id, click_count: count + 1, last_clicked_at: new Date().toISOString(),
        });
      });
    },
  };
}
