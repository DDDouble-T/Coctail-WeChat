import express, { type ErrorRequestHandler } from 'express';
import path from 'node:path';
import { rateLimit } from 'express-rate-limit';
import type { CatalogRepository } from './catalog';

interface AppOptions {
  repository: CatalogRepository;
  trustProxyHops?: number;
  rateLimitMax?: number;
  onError?: (error: unknown) => void;
  mediaRoot?: string;
}

export function createApp({ repository, trustProxyHops = 0, rateLimitMax = 120, onError = console.error, mediaRoot = path.resolve('data/iba-cocktails') }: AppOptions) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxyHops === 0 ? false : trustProxyHops);
  app.use((_request, response, next) => {
    response.set({ 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    next();
  });
  app.use((request, response, next) => {
    if (request.originalUrl.length > 2048) {
      response.status(414).json({ error: { code: 'URI_TOO_LONG', message: '请求地址过长' } });
      return;
    }
    next();
  });
  app.use(express.json({ limit: '8kb' }));

  // 只开放这两个图片目录，配方抓取快照和来源清单不作为静态文件暴露。
  for (const kind of ['crayon', 'originals']) {
    app.use(`/media/cocktails/${kind}`, express.static(path.join(mediaRoot, kind), {
      dotfiles: 'deny', index: false, redirect: false, maxAge: '1d',
      setHeaders(response) { response.setHeader('Cache-Control', 'public, max-age=86400'); },
    }));
  }

  app.get('/healthz', (_request, response) => {
    response.json({ status: 'ok', mode: repository.mode });
  });
  app.get('/readyz', async (_request, response) => {
    try {
      // 就绪探针跳过缓存，数据库故障时使发布和流量切换及时失败。
      await repository.getCatalog(true);
      response.json({ status: 'ready', mode: repository.mode });
    } catch (error) {
      onError(error);
      response.status(503).json({ error: { code: 'NOT_READY', message: '酒谱数据库尚未就绪' } });
    }
  });

  app.use('/api', rateLimit({
    windowMs: 60_000,
    limit: rateLimitMax,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // 默认直接使用连接 IP；未经明确配置的 X-Forwarded-For 不参与限流。
    validate: { xForwardedForHeader: false },
    message: { error: { code: 'TOO_MANY_REQUESTS', message: '请求频繁，请稍后重试' } },
  }));
  app.use('/api', (request, response, next) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.set('Allow', 'GET, HEAD');
      response.status(405).json({ error: { code: 'METHOD_NOT_ALLOWED', message: '此接口仅支持读取' } });
      return;
    }
    next();
  });

  app.get('/api/catalog', async (_request, response) => {
    try {
      const catalog = await repository.getCatalog();
      response.set({ 'X-Catalog-Source': repository.mode, 'Cache-Control': 'public, max-age=30' });
      response.json({ data: catalog });
    } catch (error) {
      onError(error);
      response.status(503).json({ error: { code: 'CATALOG_UNAVAILABLE', message: '酒谱暂时无法加载，请稍后重试' } });
    }
  });
  app.get('/api/cocktails/:id', async (request, response) => {
    if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(request.params.id)) {
      response.status(400).json({ error: { code: 'INVALID_ID', message: '酒谱编号格式无效' } });
      return;
    }
    try {
      const catalog = await repository.getCatalog();
      const cocktail = catalog.cocktails.find((item) => item.id === request.params.id);
      if (!cocktail) {
        response.status(404).json({ error: { code: 'COCKTAIL_NOT_FOUND', message: '没有找到这杯酒' } });
        return;
      }
      response.set({ 'X-Catalog-Source': repository.mode, 'Cache-Control': 'public, max-age=30' });
      response.json({ data: cocktail });
    } catch (error) {
      onError(error);
      response.status(503).json({ error: { code: 'CATALOG_UNAVAILABLE', message: '酒谱暂时无法加载，请稍后重试' } });
    }
  });
  app.use((_request, response) => {
    response.status(404).json({ error: { code: 'NOT_FOUND', message: '接口不存在' } });
  });
  const handleError: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const parserError = error as { type?: string };
    if (parserError.type === 'entity.too.large') {
      response.status(413).json({ error: { code: 'PAYLOAD_TOO_LARGE', message: '请求内容过大' } });
    } else if (parserError.type === 'entity.parse.failed' || error instanceof URIError) {
      response.status(400).json({ error: { code: 'BAD_REQUEST', message: '请求格式无效' } });
    } else {
      onError(error);
      response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '服务暂时无法处理请求' } });
    }
  };
  app.use(handleError);
  return app;
}
