import assert from 'node:assert/strict';
import test from 'node:test';
import { cocktails, ingredients } from '../server/src/builtin';
import { getDailyCocktail, matchCocktails as matchRecipes, normalizeIngredientIds as normalize } from '../miniprogram/shared/matching';
import type { Cocktail, IbaCategory, Ingredient } from '../miniprogram/shared/types';

const normalizeIngredientIds = (values: readonly string[], dictionary: readonly Ingredient[] = ingredients) => normalize(values, dictionary);
const matchCocktails = (recipes: readonly Cocktail[], owned: readonly string[]) => matchRecipes(recipes, owned, ingredients);

function cocktail(id: string): Cocktail {
  const found = cocktails.find((entry) => entry.id === id);
  assert.ok(found, `配方 ${id} 必须存在`);
  return found;
}

function fixture(id: string, ids: string[], category: IbaCategory = 'unforgettables'): Cocktail {
  return {
    ...cocktail('daiquiri'), id, iba_category: category,
    ingredients: ids.map((rawId) => { const ingredient_id = rawId.replace(/_/g, '-'); return { ingredient_id, name: ingredient_id, amount: '1 ml', is_essential: true, is_garnish: false }; }),
  };
}

test('柠檬、青柠、糖浆、苏打等同义词忽略大小写、空格和全角字符并去重', () => {
  assert.deepEqual(normalizeIngredientIds([
    '柠檬', '黄柠檬', ' Lemon Juice ', 'Ｌｅｍｏｎ', '莱姆', 'lime juice',
    'Gomme Syrup', '单糖浆', 'Simple Syrup', '气泡水', 'SODA WATER',
  ]), ['lemon-juice', 'lime-juice', 'simple-syrup', 'soda-water']);
});

test('归一化不把相似但不同的原料当作替代品', () => {
  assert.deepEqual(normalizeIngredientIds(['Bourbon', 'Rye Whiskey', 'Vodka', 'Vodka Citron', 'Ginger Beer', 'Ginger Ale']), [
    'bourbon', 'rye-whiskey', 'vodka', 'citron-vodka', 'ginger-beer', 'ginger-ale',
  ]);
  assert.deepEqual(normalizeIngredientIds(['矿泉水', 'Mineral Water', '葡萄柚汁', 'Rum', 'Whiskey', '不存在的材料']), []);
  assert.deepEqual(normalizeIngredientIds(['Brandy', 'Cognac']), ['brandy', 'cognac']);
});

test('归一化支持外部字典，保留首次选择顺序且不修改输入', () => {
  const selected = Object.freeze(['梨', 'Pears', 'apples', 'Pear']);
  const dictionary = [
    { id: 'apple', name_zh: '苹果', name_en: 'Apple', aliases: ['apples'], group: 'citrus' as const },
    { id: 'pear', name_zh: '梨', name_en: 'Pear', aliases: ['pears'], group: 'citrus' as const },
  ];
  assert.deepEqual(normalizeIngredientIds(selected, dictionary), ['pear', 'apple']);
  assert.deepEqual(selected, ['梨', 'Pears', 'apples', 'Pear']);
  assert.deepEqual(normalizeIngredientIds(['柠檬'], []), []);
});

test('全齐的简单配方永远排在分数更高但缺料的复杂配方前', () => {
  const results = matchCocktails([cocktail('espresso-martini'), cocktail('black-russian')], ['伏特加', 'Kahlua', '糖浆']);
  assert.deepEqual(results.map((entry) => entry.cocktail.id), ['black-russian', 'espresso-martini']);
  assert.equal(results[0].score, 200);
  assert.equal(results[1].score, 290);
  assert.equal(results[0].can_make, true);
  assert.equal(results[1].can_make, false);
});

test('同为未齐时执行匹配数、缺料数的打分顺序', () => {
  const recipes = [
    fixture('one-match', ['gin', 'lemon_juice']),
    fixture('two-matches-two-missing', ['gin', 'simple_syrup', 'lime_juice', 'lemon_juice']),
    fixture('two-matches-one-missing', ['gin', 'simple_syrup', 'lemon_juice']),
  ];
  const results = matchCocktails(recipes, ['Gin', 'Gomme Syrup']);
  assert.deepEqual(results.map((entry) => entry.cocktail.id), ['two-matches-one-missing', 'two-matches-two-missing', 'one-match']);
  assert.deepEqual(results.map((entry) => entry.score), [190, 180, 90]);
  assert.deepEqual(results[0].missing_ingredients.map((line) => line.ingredient_id), ['lemon-juice']);
});

test('装饰不阻止制作，只给一分加成；可选蛋清不计缺料', () => {
  const negroni = cocktail('negroni');
  const owned = ['gin', 'campari', 'sweet_vermouth'];
  const withoutGarnish = matchCocktails([negroni], owned)[0];
  assert.equal(withoutGarnish.can_make, true);
  assert.equal(withoutGarnish.total_essential, 3);
  assert.equal(withoutGarnish.score, 300);
  assert.equal(matchCocktails([negroni], [...owned, '橙片'])[0].score, 301);
  assert.equal(matchCocktails([cocktail('whiskey-sour')], ['Bourbon', '柠檬', '糖浆'])[0].can_make, true);
});

test('Mojito 的薄荷是必备，Between the Sheets 两种基酒均不能省略', () => {
  const mojito = cocktail('mojito');
  const owned = mojito.ingredients.filter((line) => line.is_essential && line.ingredient_id !== 'mint').map((line) => line.ingredient_id);
  const result = matchCocktails([mojito], owned)[0];
  assert.equal(result.can_make, false);
  assert.deepEqual(result.missing_ingredients.map((line) => line.ingredient_id), ['mint']);
  assert.equal(matchCocktails([mojito], [...owned, '薄荷叶'])[0].can_make, true);
  assert.equal(matchCocktails([cocktail('between-the-sheets')], ['White Rum', 'Triple Sec', 'Lemon'])[0].can_make, false);
});

test('同分先按 IBA 经典度再按 ID，排序可预测且不修改配方列表', () => {
  const recipes = [
    fixture('new', ['gin'], 'new_era'), fixture('classic', ['gin'], 'contemporary_classics'),
    fixture('z', ['gin']), fixture('a', ['gin']),
  ];
  const original = recipes.map((entry) => entry.id);
  assert.deepEqual(matchCocktails(recipes, ['gin']).map((entry) => entry.cocktail.id), ['a', 'z', 'classic', 'new']);
  assert.deepEqual(recipes.map((entry) => entry.id), original);
});

test('返回所有匹配供 UI 自行折叠；状态分界为缺 0、1–2、3 种及以上', () => {
  const recipes = [fixture('zero', []), fixture('one', ['gin']), fixture('two', ['gin', 'vodka']), fixture('three', ['gin', 'vodka', 'bourbon']), fixture('four', ['gin', 'vodka', 'bourbon', 'pisco'])];
  const results = matchCocktails(recipes, []);
  assert.equal(results.length, 5);
  assert.deepEqual(results.map((entry) => entry.status), ['ready', 'almost', 'almost', 'far', 'far']);
  assert.equal(matchCocktails(cocktails, []).length, cocktails.length);
  assert.deepEqual(matchCocktails([], ['gin']), []);
});

test('所有材料已备齐时全部可做，未知和重复材料不改变得分', () => {
  const all = ingredients.map((entry) => entry.id);
  const results = matchCocktails(cocktails, all);
  assert.ok(results.every((entry) => entry.can_make && entry.missing_essential === 0));
  assert.deepEqual(matchCocktails(cocktails, [...all, 'gin', '未知材料']), results);
});

const dailyRecipes = Array.from({ length: 17 }, (_, index) => fixture(`daily-${index}`, ['gin']));

test('每日推荐使用上海午夜切换，与执行设备时区无关', () => {
  assert.equal(getDailyCocktail(dailyRecipes, new Date('2026-10-30T15:59:59Z'))?.id, `daily-${303 % 17}`);
  assert.equal(getDailyCocktail(dailyRecipes, new Date('2026-10-30T16:00:00Z'))?.id, `daily-${304 % 17}`);
  assert.equal(getDailyCocktail(dailyRecipes, new Date('2026-10-31T00:00:00+08:00'))?.id, `daily-${304 % 17}`);
});

test('年内日序从 1 开始，正确处理闰日和跨年重置', () => {
  for (const [date, day] of [
    ['2024-01-01T04:00:00Z', 1], ['2024-02-29T04:00:00Z', 60], ['2024-03-01T04:00:00Z', 61],
    ['2023-03-01T04:00:00Z', 60], ['2024-12-31T15:59:59Z', 366], ['2024-12-31T16:00:00Z', 1],
  ] as const) {
    assert.equal(getDailyCocktail(dailyRecipes, new Date(date))?.id, `daily-${day % 17}`, date);
  }
});

test('空目录、无效日期安全返回 undefined，单配方每天都能返回', () => {
  assert.equal(getDailyCocktail([], new Date()), undefined);
  assert.equal(getDailyCocktail(dailyRecipes, new Date('invalid')), undefined);
  assert.equal(getDailyCocktail([dailyRecipes[0]], new Date('2024-02-29T12:00:00+08:00')), dailyRecipes[0]);
});
