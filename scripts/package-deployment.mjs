import { mkdir, copyFile, cp, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const staging = path.join(root, 'artifacts/cat-tavern-deploy');
await rm(staging, { recursive: true, force: true });
await mkdir(staging, { recursive: true });
// 用显式允许列表打包，避免本机配置、凭证和开发者工具缓存进入部署包。
for (const file of ['package.json', 'package-lock.json', '.dockerignore', 'README.md']) {
  await copyFile(path.join(root, file), path.join(staging, file));
}
for (const directory of ['server/src', 'server/data', 'server/tcb', 'miniprogram/shared', 'data/iba-cocktails/crayon', 'data/iba-cocktails/originals']) {
  await cp(path.join(root, directory), path.join(staging, directory), { recursive: true });
}
for (const file of ['server/Dockerfile', 'server/tsconfig.json', 'server/.env.example', 'docs/deployment.md']) {
  await mkdir(path.dirname(path.join(staging, file)), { recursive: true });
  await copyFile(path.join(root, file), path.join(staging, file));
}
await copyFile(path.join(root, 'server/Dockerfile'), path.join(staging, 'Dockerfile'));
await copyFile(path.join(root, 'docs/cloudbase-cli.md'), path.join(staging, 'docs/cloudbase-cli.md'));
await copyFile(path.join(root, 'docs/git-pipeline.md'), path.join(staging, 'docs/git-pipeline.md'));
await mkdir(path.join(staging, 'scripts'), { recursive: true });
for (const file of ['export-tcb-data.ts', 'seed-tcb-cli.mjs', 'verify-backend.mjs']) {
  await copyFile(path.join(root, 'scripts', file), path.join(staging, 'scripts', file));
}
await writeFile(path.join(staging, 'DEPLOY.txt'), '服务：paw-inn\n构建上下文：当前目录\nDockerfile：Dockerfile（仓库 Git 流水线使用 server/Dockerfile）\n端口：80\n环境变量：NODE_ENV=production, CLOUD_BASE_ENV_ID=paw-inn-d9gixxkg3f894407e, CLOUDBASE_APIKEY=<在平台配置服务端密钥>\n先导入 server/tcb/ingredients.jsonl，再导入 cocktails.jsonl；或 npm ci 后使用 scripts/seed-tcb-cli.mjs / npm run db:seed\n探针：/healthz 和 /readyz；就绪后切换服务流量。详见 docs/deployment.md。\n');
const archive = path.join(root, 'artifacts/cat-tavern-tcb-deploy.tar.gz');
execFileSync('tar', ['-czf', archive, '-C', staging, '.'], {
  stdio: 'inherit', env: { ...process.env, COPYFILE_DISABLE: '1' },
});
console.info(`部署包：${archive}`);
