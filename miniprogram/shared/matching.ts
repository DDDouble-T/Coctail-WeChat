import { ingredients } from './catalog';
import type { Cocktail, Ingredient, IbaCategory, MatchResult } from './types';

function ingredientKey(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/[\s_-]+/g, '');
}

/** 只识别字典中的同义词，不把不同基酒或原料视作替代品。 */
export function normalizeIngredientIds(
  values: readonly string[],
  dictionary: readonly Ingredient[] = ingredients,
): string[] {
  const aliases = new Map<string, string>();
  dictionary.forEach((ingredient) => {
    [ingredient.id, ingredient.name_zh, ingredient.name_en, ...ingredient.aliases].forEach((name) => {
      aliases.set(ingredientKey(name), ingredient.id);
    });
  });
  const normalized = new Set<string>();
  values.forEach((value) => {
    const id = aliases.get(ingredientKey(value));
    if (id) normalized.add(id);
  });
  return Array.from(normalized);
}

const classicOrder: Record<IbaCategory, number> = {
  unforgettables: 0,
  contemporary_classics: 1,
  new_era: 2,
};

export function matchCocktails(recipes: readonly Cocktail[], owned: readonly string[]): MatchResult[] {
  // 同时支持目录之外、已经归一的配方 ID；同义词仍以材料字典为准。
  const ownedIds = new Set([...owned, ...normalizeIngredientIds(owned)]);
  return recipes.map((cocktail): MatchResult => {
    const essential = cocktail.ingredients.filter((line) => line.is_essential && !line.is_garnish);
    const missing = essential.filter((line) => !ownedIds.has(line.ingredient_id));
    const matched = essential.length - missing.length;
    const garnish = cocktail.ingredients.filter((line) => line.is_garnish && ownedIds.has(line.ingredient_id)).length;
    const canMake = missing.length === 0;
    return {
      cocktail,
      matched_essential: matched,
      total_essential: essential.length,
      missing_essential: missing.length,
      matched_garnish: garnish,
      missing_ingredients: missing,
      score: matched * 100 - missing.length * 10 + garnish,
      can_make: canMake,
      status: canMake ? 'ready' : missing.length <= 2 ? 'almost' : 'far',
    };
  }).sort((left, right) => {
    // 完全备齐的简单配方应先出现，即使其材料数少、原始分数更低。
    return Number(right.can_make) - Number(left.can_make)
      || right.score - left.score
      || classicOrder[left.cocktail.iba_category] - classicOrder[right.cocktail.iba_category]
      || left.cocktail.id.localeCompare(right.cocktail.id, 'en');
  });
}

/** 使用上海日历日，避免手机时区和夏令时让「今日特调」提前切换。 */
export function getDailyCocktail(recipes: readonly Cocktail[], date: Date = new Date()): Cocktail | undefined {
  if (recipes.length === 0 || !Number.isFinite(date.getTime())) return undefined;
  const shanghai = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const year = shanghai.getUTCFullYear();
  const dayOfYear = Math.floor((Date.UTC(year, shanghai.getUTCMonth(), shanghai.getUTCDate()) - Date.UTC(year, 0, 1)) / 86400000) + 1;
  return recipes[dayOfYear % recipes.length];
}
