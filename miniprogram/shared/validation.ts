import { Catalog } from './types';

const families = ['sour', 'fizz', 'collins', 'highball', 'old_fashioned', 'martini', 'daisy', 'other'];
const groups = ['base', 'liqueur', 'syrup', 'citrus', 'mixer', 'garnish'];
const ibaCategories = ['unforgettables', 'contemporary_classics', 'new_era'];
const styles = ['shake', 'stir', 'build', 'blend'];
const difficulties = ['easy', 'medium', 'advanced'];
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 3000;
const isId = (value: unknown): value is string => typeof value === 'string' && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(value);

// 缓存与远端数据走同一道校验，拒绝不完整目录及非后端媒体路径。
export function isCatalog(value: unknown): value is Catalog {
  if (!isObject(value) || !isText(value.version) || !Array.isArray(value.ingredients) || !Array.isArray(value.cocktails)) return false;
  if (!value.ingredients.length || !value.cocktails.length || value.ingredients.length > 1000 || value.cocktails.length > 1000) return false;
  const ingredientIds = new Set<string>();
  for (const item of value.ingredients) {
    if (!isObject(item) || !isId(item.id) || ingredientIds.has(item.id) || !isText(item.name_zh) || !isText(item.name_en)) return false;
    if (!groups.includes(item.group as string) || !Array.isArray(item.aliases) || !item.aliases.every(isText)) return false;
    ingredientIds.add(item.id);
  }
  const cocktailIds = new Set<string>();
  for (const recipe of value.cocktails) {
    if (!isObject(recipe) || !isId(recipe.id) || cocktailIds.has(recipe.id)) return false;
    for (const key of ['name_zh', 'name_en', 'glass', 'taste', 'healing_copy', 'image_url', 'image_original_url', 'source_url']) {
      if (!isText(recipe[key])) return false;
    }
    if (!/^https:\/\/iba-world\.com\//.test(recipe.source_url as string)) return false;
    if (!/^\/media\/cocktails\/originals\/[a-z0-9][a-z0-9_-]{0,79}\.(?:webp|jpe?g|png)$/.test(recipe.image_original_url as string)) return false;
    // 只允许云托管的鸡尾酒媒体目录，图片组件负责鉴权下载与本地缓存。
    if (!/^\/media\/cocktails\/crayon\/[a-z0-9][a-z0-9_-]{0,79}-crayon\.webp$/.test(recipe.image_url as string)) return false;
    if (!families.includes(recipe.family as string) || !ibaCategories.includes(recipe.iba_category as string) || !styles.includes(recipe.style as string) || !difficulties.includes(recipe.difficulty as string)) return false;
    if (!Array.isArray(recipe.steps) || !recipe.steps.length || !recipe.steps.every(isText)) return false;
    if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length || recipe.ingredients.length > 40) return false;
    let essentialCount = 0;
    const lineIds = new Set<string>();
    for (const line of recipe.ingredients) {
      if (!isObject(line) || !isId(line.ingredient_id) || !ingredientIds.has(line.ingredient_id) || lineIds.has(line.ingredient_id)) return false;
      if (!isText(line.name) || !isText(line.amount) || typeof line.is_essential !== 'boolean' || typeof line.is_garnish !== 'boolean') return false;
      if (line.is_essential && line.is_garnish) return false;
      if (line.is_essential) essentialCount++;
      lineIds.add(line.ingredient_id);
    }
    if (!essentialCount) return false;
    cocktailIds.add(recipe.id);
  }
  return true;
}
