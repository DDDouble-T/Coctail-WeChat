import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertReadBack, assertWriteAcknowledged, createUpsertCommand, parseCliResults, parseJsonLines, parseOptions,
} from '../scripts/seed-tcb-cli.mjs';

const ingredient = { _id: 'gin', id: 'gin', name_zh: '金酒', name_en: 'Gin', aliases: ["Gordon's", '金酒\\琴酒'], group: 'base' };

test('CLI 初始化默认不写入，写入需要显式环境，拒绝无效 ID 与重复记录', () => {
  assert.equal(parseOptions([]).write, false);
  assert.throws(() => parseOptions(['--write']), /显式指定/);
  assert.throws(() => parseOptions(['--limit', '1.5']), /limit/);
  assert.throws(() => parseOptions(['--collection', 'users']), /collection/);
  assert.equal(parseOptions(['--concurrency', '4']).concurrency, 4);
  assert.throws(() => parseOptions(['--concurrency', '0']), /concurrency/);
  assert.throws(() => parseOptions(['--concurrency', '5']), /concurrency/);
  assert.throws(() => parseJsonLines(JSON.stringify({ ...ingredient, _id: 'wrong' }), 'ingredients'), /稳定 ID/);
  assert.throws(() => parseJsonLines(`${JSON.stringify(ingredient)}\n${JSON.stringify(ingredient)}`, 'ingredients'), /重复/);
  assert.throws(() => parseJsonLines(JSON.stringify({ ...ingredient, '$unset': { name_en: true } }), 'ingredients'), /字段名/);
  assert.deepEqual(parseJsonLines(`${JSON.stringify(ingredient)}\n`, 'ingredients'), [ingredient]);
});

test('单条 upsert 按稳定 _id 匹配，保留中文与特殊字符，不修改不可变 _id', () => {
  const [command] = createUpsertCommand('ingredients', ingredient);
  assert.equal(command.CommandType, 'UPDATE');
  const update = JSON.parse(command.Command);
  assert.deepEqual(update.updates[0].q, { _id: 'gin' });
  assert.equal(update.updates[0].upsert, true);
  assert.equal(update.updates[0].multi, false);
  assert.equal('_id' in update.updates[0].u.$set, false);
  assert.deepEqual(update.updates[0].u.$set.aliases, ingredient.aliases);
});

test('真实 TCB 扩展 JSON 写入应答和查询结果可校验，内层错误不能误报成功', () => {
  const response = (results: unknown) => JSON.stringify({ data: { results, requestId: 'request-id' } });
  const ack = { n: { $numberInt: '1' }, nModified: { $numberInt: '0' }, ok: { $numberDouble: '1.0' }, upserted: [{ _id: 'gin' }] };
  assertWriteAcknowledged(parseCliResults(response([[ack]])));
  assertReadBack(parseCliResults(`ℹ Query\n${response([[ingredient]])}`), ingredient);
  assert.throws(() => assertWriteAcknowledged(parseCliResults(response([[{ ...ack, n: { $numberInt: '0' } }]]))), /恰好/);
  assert.throws(() => parseCliResults(response([[{ ...ack, writeErrors: [{ code: 11000, errmsg: 'duplicate' }] }]])), /错误/);
  assert.throws(() => parseCliResults(response([[{ ok: { $numberInt: '0' } }]])), /未成功/);
  assert.throws(() => parseCliResults(JSON.stringify({ Error: { Code: 'AuthFailure' } })), /AuthFailure/);
  assert.throws(() => assertReadBack([{ ...ingredient, aliases: [] }], ingredient), /aliases/);
  assertReadBack([{ ...ingredient, backend_only_metadata: 'retained' }], ingredient);
});
