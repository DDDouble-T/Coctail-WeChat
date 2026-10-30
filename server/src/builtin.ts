import snapshot from '../data/catalog.json';
import type { Catalog } from '../../miniprogram/shared/types';
import { isCatalog } from '../../miniprogram/shared/validation';

// 全量种子只随服务端发布；客户端通过 API 获取，避免主包包含酒谱和图片。
const candidate: unknown = snapshot;
if (!isCatalog(candidate)) throw new Error('服务端 IBA 酒谱快照未通过校验');

export const builtinCatalog: Catalog = candidate;
export const { version: CATALOG_VERSION, cocktails, ingredients } = builtinCatalog;
