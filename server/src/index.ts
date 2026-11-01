import { createApp } from './app';
import { createCatalogRepository } from './catalog';
import { readConfig } from './config';
import { connectDatabase, createCatalogDatabase } from './database';
import { createClickRepository } from './clicks';

const config = readConfig();
const repository = createCatalogRepository(config.envId ? createCatalogDatabase(config) : undefined);
const clicks = createClickRepository(config.envId ? connectDatabase(config) : undefined);
const app = createApp({ repository, clicks, trustProxyHops: config.trustProxyHops });
const server = app.listen(config.port, '0.0.0.0', () => {
  console.info(`猫咪酒馆 API 正在监听 ${config.port}，数据模式：${repository.mode}`);
});
server.requestTimeout = 15_000;
server.headersTimeout = 10_000;
server.keepAliveTimeout = 5_000;

function shutdown() {
  server.close((error) => {
    process.exitCode = error ? 1 : 0;
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
