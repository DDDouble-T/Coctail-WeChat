import { createHash } from 'node:crypto';
import { CATALOG_VERSION, cocktails, ingredients } from '../../miniprogram/shared/catalog';
import type { Catalog, Cocktail, Ingredient } from '../../miniprogram/shared/types';
import { isCatalog } from '../../miniprogram/shared/validation';
import type { CatalogDatabase, CollectionName } from './database';

export interface CatalogRepository {
  readonly mode: 'builtin' | 'cloud';
  getCatalog(fresh?: boolean): Promise<Catalog>;
}

const PAGE_SIZE = 100;

async function readCollection(database: CatalogDatabase, collection: CollectionName): Promise<unknown[]> {
  const documents: unknown[] = [];
  for (;;) {
    const page = await database.readPage(collection, documents.length, PAGE_SIZE);
    documents.push(...page);
    if (page.length < PAGE_SIZE) return documents;
  }
}

function publicIngredient(ingredient: Ingredient): Ingredient {
  return {
    id: ingredient.id,
    name_zh: ingredient.name_zh,
    name_en: ingredient.name_en,
    aliases: [...ingredient.aliases],
    group: ingredient.group,
  };
}

function publicCocktail(cocktail: Cocktail): Cocktail {
  return {
    id: cocktail.id,
    name_zh: cocktail.name_zh,
    name_en: cocktail.name_en,
    iba_category: cocktail.iba_category,
    family: cocktail.family,
    glass: cocktail.glass,
    style: cocktail.style,
    difficulty: cocktail.difficulty,
    taste: cocktail.taste,
    healing_copy: cocktail.healing_copy,
    image_url: cocktail.image_url,
    image_original_url: cocktail.image_original_url,
    source_url: cocktail.source_url,
    ingredients: cocktail.ingredients.map((line) => ({
      ingredient_id: line.ingredient_id,
      name: line.name,
      amount: line.amount,
      is_essential: line.is_essential,
      is_garnish: line.is_garnish,
    })),
    steps: [...cocktail.steps],
  };
}

export function createCatalogRepository(database?: CatalogDatabase, cacheMs = 30_000): CatalogRepository {
  const builtin: Catalog = { version: CATALOG_VERSION, cocktails, ingredients };
  let cached: { catalog: Catalog; expiresAt: number } | undefined;
  let pending: Promise<Catalog> | undefined;
  return {
    mode: database ? 'cloud' : 'builtin',
    async getCatalog(fresh = false) {
      if (!database) return builtin;
      if (!fresh && cached && Date.now() < cached.expiresAt) return cached.catalog;
      if (pending) return pending;
      pending = (async () => {
        const [cloudCocktails, cloudIngredients] = await Promise.all([
          readCollection(database, 'cocktails'),
          readCollection(database, 'ingredients'),
        ]);
        const candidate: unknown = {
          version: CATALOG_VERSION,
          cocktails: cloudCocktails,
          ingredients: cloudIngredients,
        };
        if (!isCatalog(candidate)) throw new Error('云数据库酒谱结构不完整，请检查数据或执行初始化');
        // 只输出公开业务字段，避免 SDK 元数据或后台新增字段泄露给客户端。
        const catalog: Catalog = {
          version: '',
          cocktails: candidate.cocktails.map(publicCocktail),
          ingredients: candidate.ingredients.map(publicIngredient),
        };
        catalog.version = `cloud-${createHash('sha256').update(JSON.stringify(catalog)).digest('hex').slice(0, 16)}`;
        cached = { catalog, expiresAt: Date.now() + cacheMs };
        return catalog;
      })();
      try {
        return await pending;
      } catch (error) {
        cached = undefined;
        throw error;
      } finally {
        pending = undefined;
      }
    },
  };
}
