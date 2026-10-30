import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify, isDeepStrictEqual } from 'node:util';
import { tsImport } from 'tsx/esm/api';

const executeFile = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliVersion = '3.8.10';
const maxDocumentBytes = 32 * 1024;
const collections = ['ingredients', 'cocktails'];

export function parseOptions(args) {
  const options = { write: false, verify: false, envId: '', region: '', collection: '', limit: Infinity, concurrency: 3, input: path.join(root, 'server/tcb') };
  for (let index = 0; index < args.length; index++) {
    const flag = args[index];
    if (flag === '--write') options.write = true;
    else if (flag === '--verify') options.verify = true;
    else if (flag === '--help') options.help = true;
    else {
      const key = { '--env-id': 'envId', '--region': 'region', '--collection': 'collection', '--limit': 'limit', '--concurrency': 'concurrency', '--input': 'input' }[flag];
      if (!key || !args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`无效参数：${flag}`);
      const value = args[++index];
      options[key] = key === 'limit' || key === 'concurrency' ? Number(value) : value;
      if (key === 'limit' && (!/^\d+$/.test(value) || !Number.isInteger(options.limit) || options.limit < 1 || options.limit > 1000)) {
        throw new Error('--limit 必须是 1 到 1000 之间的整数');
      }
      if (key === 'concurrency' && (!/^\d+$/.test(value) || options.concurrency < 1 || options.concurrency > 4)) {
        throw new Error('--concurrency 必须是 1 到 4 之间的整数');
      }
    }
  }
  if (options.collection && !collections.includes(options.collection)) throw new Error('--collection 仅支持 ingredients 或 cocktails');
  if (options.envId && !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(options.envId)) throw new Error('环境 ID 格式无效');
  if (options.region && !/^[a-z]{2}-[a-z]+(?:-\d+)?$/.test(options.region)) throw new Error('地域格式无效');
  if ((options.write || options.verify) && !options.envId) throw new Error('--write / --verify 必须显式指定 --env-id');
  return options;
}

export function parseJsonLines(text, collection) {
  const seen = new Set();
  return text.split(/\r?\n/).filter((line) => line.trim()).map((line, index) => {
    let record;
    try { record = JSON.parse(line); } catch { throw new Error(`${collection} 第 ${index + 1} 行不是合法 JSON`); }
    if (!record || Array.isArray(record) || typeof record !== 'object'
      || !/^[a-z0-9][a-z0-9_-]{0,79}$/.test(record.id) || record._id !== record.id || seen.has(record.id)) {
      throw new Error(`${collection} 第 ${index + 1} 行的稳定 ID 无效或重复`);
    }
    if (Buffer.byteLength(line) > maxDocumentBytes) throw new Error(`${collection}/${record.id} 超过本脚本 32 KiB 单文档限制`);
    // $set 的键只允许公开字段；禁止输入操作符或点路径，以免改变更新语义。
    if (Object.keys(record).some((key) => key.startsWith('$') || key.includes('.') || key === '__proto__')) {
      throw new Error(`${collection}/${record.id} 存在无效字段名`);
    }
    seen.add(record.id);
    return record;
  });
}

export function createUpsertCommand(collection, record) {
  if (!collections.includes(collection)) throw new Error('无效集合名');
  const { _id, ...fields } = record;
  return [{
    TableName: collection,
    CommandType: 'UPDATE',
    Command: JSON.stringify({ update: collection, ordered: true, updates: [{ q: { _id }, u: { $set: fields }, upsert: true, multi: false }] }),
  }];
}

export function createReadCommand(collection, id) {
  return [{ TableName: collection, CommandType: 'QUERY', Command: JSON.stringify({ find: collection, filter: { _id: id }, limit: 2 }) }];
}

function safeErrorCode(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(value) ? `（${value}）` : '';
}

function assertNoErrors(value) {
  if (!value || typeof value !== 'object') return;
  if ((value.Error && typeof value.Error === 'object') || value.error || value.errmsg || value.$err
    || (Array.isArray(value.writeErrors) && value.writeErrors.length) || value.writeConcernError) {
    throw new Error(`云数据库返回错误${safeErrorCode(value.Error?.Code ?? value.code)}`);
  }
  if ('ok' in value && numeric(value.ok) !== 1) throw new Error('云数据库命令未成功');
  for (const [key, entry] of Object.entries(value)) {
    // 不记录或解析与业务结果无关的签名、时钟等 MongoDB 元数据。
    if (!['$clusterTime', 'opTime', 'operationTime'].includes(key)) assertNoErrors(entry);
  }
}

function numeric(value) {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    for (const key of ['$numberInt', '$numberLong', '$numberDouble']) {
      if (typeof value[key] === 'string') return Number(value[key]);
    }
  }
  return NaN;
}

export function parseCliResults(stdout) {
  const cleaned = stdout.replace(/\u001b\[[0-9;]*m/g, '').trim();
  const start = cleaned.indexOf('{');
  let response;
  try { response = JSON.parse(cleaned.slice(start)); } catch { throw new Error('CloudBase CLI 未返回合法 JSON'); }
  assertNoErrors(response);
  const result = response?.data?.results;
  if (!Array.isArray(result) || result.length !== 1) throw new Error('CloudBase CLI 命令结果数量异常');
  const decode = (value) => {
    if (typeof value === 'string') {
      try { return decode(JSON.parse(value)); } catch { throw new Error('云数据库结果不是合法 JSON'); }
    }
    return Array.isArray(value) ? value.flatMap((item) => decode(item)) : [value];
  };
  const decoded = decode(result);
  decoded.forEach(assertNoErrors);
  return decoded;
}

export function assertWriteAcknowledged(results) {
  if (results.length !== 1 || numeric(results[0]?.ok) !== 1 || numeric(results[0]?.n) !== 1) {
    throw new Error('单条 upsert 未确认恰好写入或命中 1 条记录');
  }
}

export function assertReadBack(results, expected) {
  if (results.length !== 1 || results[0]?._id !== expected._id) throw new Error(`读回 ${expected._id} 未得到唯一记录`);
  // $set 保留后台额外字段；逐个比较本次管理的字段，不能只以条数推断写入正确。
  for (const [key, value] of Object.entries(expected)) {
    if (!isDeepStrictEqual(results[0][key], value)) throw new Error(`读回 ${expected._id} 的 ${key} 与源数据不一致`);
  }
}

async function resolveCli() {
  let stdout;
  try {
    ({ stdout } = await executeFile('npx', ['-y', '--package', `@cloudbase/cli@${cliVersion}`, '-c', 'command -v tcb'], { timeout: 120_000, maxBuffer: 1024 * 1024 }));
  } catch { throw new Error(`无法解析 CloudBase CLI ${cliVersion}，请检查 npm 与网络`); }
  const filename = stdout.trim();
  if (!path.isAbsolute(filename) || /[\r\n]/.test(filename)) throw new Error('CloudBase CLI 可执行路径异常');
  return filename;
}

async function runCommand(cliPath, options, command) {
  const args = [cliPath, 'db', 'nosql', 'execute', '--env-id', options.envId, '--command', JSON.stringify(command), '--json'];
  if (options.region) args.push('--region', options.region);
  try {
    const { stdout } = await executeFile(process.execPath, args, { timeout: 120_000, maxBuffer: 2 * 1024 * 1024 });
    return parseCliResults(stdout);
  } catch (error) {
    // execFile 的默认错误会带完整 argv/stdout/stderr；只输出受控说明，避免凭证或签名进入日志。
    if (typeof error?.code === 'string' || typeof error?.code === 'number') throw new Error(`CloudBase CLI 调用失败${safeErrorCode(String(error.code))}，请检查登录、权限与网络`);
    throw error;
  }
}

export async function main(args = process.argv.slice(2)) {
  const options = parseOptions(args);
  if (options.help) {
    console.info('用法：node scripts/seed-tcb-cli.mjs [--env-id ENV] [--region REGION] [--collection ingredients|cocktails] [--limit N] [--concurrency 1-4] [--input DIR] [--write|--verify]');
    console.info('默认仅校验并预览；--write 单条幂等写入并立即读回；--verify 只读核对。请先执行 npm run db:export 并确认集合已创建。');
    return;
  }
  const records = {};
  for (const collection of collections) {
    records[collection] = parseJsonLines(await readFile(path.join(options.input, `${collection}.jsonl`), 'utf8'), collection);
  }
  const { isCatalog } = await tsImport('../miniprogram/shared/validation.ts', import.meta.url);
  if (!isCatalog({ version: 'cli-seed-validation', ...records })) throw new Error('TCB JSON Lines 未通过共享目录校验，停止操作');
  const selected = collections.filter((name) => !options.collection || name === options.collection)
    .flatMap((collection) => records[collection].map((record) => ({ collection, record }))).slice(0, options.limit);
  console.info(`校验通过：${records.ingredients.length} 种原料、${records.cocktails.length} 款鸡尾酒；本次 ${selected.length} 条；环境 ${options.envId || '未指定'}`);
  if (!options.write && !options.verify) {
    console.info('预览完成，未调用云端。每次只发送 1 条、每条不超过 32 KiB；这是脚本保守限制，不代表平台上限。');
    return;
  }
  const cliPath = await resolveCli();
  let completed = 0;
  // 原料全部写入并校验后再处理酒谱；仅不同 ID 的文档并发，保持引用顺序。
  for (const collection of collections) {
    const entries = selected.filter((entry) => entry.collection === collection);
    let cursor = 0;
    let failure;
    async function worker() {
      while (!failure && cursor < entries.length) {
        const { record } = entries[cursor++];
        try {
          if (options.write) assertWriteAcknowledged(await runCommand(cliPath, options, createUpsertCommand(collection, record)));
          assertReadBack(await runCommand(cliPath, options, createReadCommand(collection, record._id)), record);
          console.info(`${++completed}/${selected.length} ${collection}/${record._id} ${options.write ? '写入并读回一致' : '读回一致'}`);
        } catch (error) {
          failure = new Error(`${collection}/${record._id}：${error instanceof Error ? error.message : '执行失败'}；可按稳定 ID 重试`);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(options.concurrency, entries.length) }, worker));
    if (failure) throw new Error(`${failure.message}；已验证 ${completed} 条`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : 'TCB CLI 初始化失败');
    process.exitCode = 1;
  });
}
