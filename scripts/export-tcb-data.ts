import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { builtinCatalog } from '../server/src/builtin';

async function main() {
  const output = path.resolve('server/tcb');
  await mkdir(output, { recursive: true });
  for (const collection of ['ingredients', 'cocktails'] as const) {
    // TCB 控制台按行导入 JSON；稳定 _id 使控制台覆盖导入与 seed 保持一致。
    const records = builtinCatalog[collection].map((record) => JSON.stringify({ _id: record.id, ...record }));
    await writeFile(path.join(output, `${collection}.jsonl`), `${records.join('\n')}\n`);
    console.info(`${collection}: ${records.length} 条 → server/tcb/${collection}.jsonl`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'TCB 导出失败');
  process.exitCode = 1;
});
