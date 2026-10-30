export type Family = 'sour' | 'fizz' | 'collins' | 'highball' | 'old_fashioned' | 'martini' | 'daisy' | 'other';
export type IbaCategory = 'unforgettables' | 'contemporary_classics' | 'new_era';
export type IngredientGroup = 'base' | 'liqueur' | 'syrup' | 'citrus' | 'mixer' | 'garnish';
export type Style = 'shake' | 'stir' | 'build' | 'blend';

export interface Ingredient {
  id: string;
  name_zh: string;
  name_en: string;
  aliases: string[];
  group: IngredientGroup;
}

export interface IngredientLine {
  ingredient_id: string;
  name: string;
  amount: string;
  is_essential: boolean;
  is_garnish: boolean;
}

export interface Cocktail {
  id: string;
  name_zh: string;
  name_en: string;
  iba_category: IbaCategory;
  family: Family;
  glass: string;
  style: Style;
  difficulty: 'easy' | 'medium' | 'advanced';
  taste: string;
  healing_copy: string;
  image_url: string;
  image_original_url: string;
  source_url: string;
  ingredients: IngredientLine[];
  steps: string[];
}

export interface Catalog {
  version: string;
  cocktails: Cocktail[];
  ingredients: Ingredient[];
}

export interface MatchResult {
  cocktail: Cocktail;
  matched_essential: number;
  total_essential: number;
  missing_essential: number;
  matched_garnish: number;
  missing_ingredients: IngredientLine[];
  score: number;
  can_make: boolean;
  status: 'ready' | 'almost' | 'far';
}
