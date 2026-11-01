import { ibaLabels, styleLabels } from '../shared/catalog';
import { matchCocktails } from '../shared/matching';
import { Cocktail, MatchResult } from '../shared/types';

export interface RecipeCard {
  id: string;
  name: string;
  english: string;
  image: string;
  glass: string;
  style: string;
  difficulty: string;
  essential: number;
  matched: number;
  missing: string;
  progress: number;
  showProgress: boolean;
  matching: boolean;
  status: string;
  statusLabel: string;
}

export function toCard(recipe: Cocktail, owned: readonly string[], matching = false, result?: MatchResult): RecipeCard {
  // 页面已使用当前后端材料字典归一 ID；卡片只处理这些 ID，不再依赖内置原料。
  const match = result || matchCocktails([recipe], owned)[0];
  return {
    id: recipe.id, name: recipe.name_zh, english: recipe.name_en,
    image: recipe.image_original_url, glass: recipe.glass, style: styleLabels[recipe.style],
    difficulty: { easy: '轻松入门', medium: '进阶一点', advanced: '挑战一下' }[recipe.difficulty],
    essential: match.total_essential, matched: match.matched_essential,
    missing: match.missing_ingredients.map((item) => item.name).join('、'),
    progress: Math.round(match.matched_essential / match.total_essential * 100),
    showProgress: owned.length > 0, matching, status: match.status,
    statusLabel: match.can_make ? '材料齐全' : match.missing_essential <= 2 ? '差一点点' : '还差几样',
  };
}

export function ibaLabel(recipe: Cocktail): string { return ibaLabels[recipe.iba_category]; }
