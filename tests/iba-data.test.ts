import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { builtinCatalog } from '../server/src/builtin';

type OfficialRecipe = {
  slug: string;
  name_en: string;
  source_url: string;
  iba_category: string;
  ingredients: string[];
  method: string[];
  garnish: string[];
};
const root = process.cwd();
const official = JSON.parse(readFileSync(path.join(root, 'data/iba-cocktails/recipes-source.json'), 'utf8')) as {
  source_sitemap: string;
  cocktails: OfficialRecipe[];
};
const byId = new Map(builtinCatalog.cocktails.map((recipe) => [recipe.id, recipe]));
const line = (cocktailId: string, ingredientId: string) => {
  const ingredient = byId.get(cocktailId)?.ingredients.find((entry) => entry.ingredient_id === ingredientId);
  assert.ok(ingredient, `${cocktailId}: ${ingredientId}`);
  return ingredient;
};

test('后端快照逐条对应官方来源，覆盖三分类全部 102 款而非名称占位', () => {
  assert.equal(official.source_sitemap, 'https://iba-world.com/wp-sitemap-posts-iba-cocktail-1.xml');
  assert.equal(official.cocktails.length, 102);
  assert.deepEqual(new Set(official.cocktails.map((recipe) => recipe.slug)), new Set(byId.keys()));
  const counts: Record<string, number> = {};
  for (const recipe of official.cocktails) {
    const catalog = byId.get(recipe.slug)!;
    assert.equal(catalog.name_en, recipe.name_en);
    assert.equal(catalog.iba_category, recipe.iba_category);
    assert.equal(catalog.source_url, recipe.source_url);
    assert.ok(recipe.ingredients.length >= 2 && recipe.method.length >= 1, recipe.slug);
    assert.match(catalog.name_zh, /[\u3400-\u9fff]/, recipe.slug);
    assert.ok(catalog.steps.every((step) => /[\u3400-\u9fff]/.test(step)), recipe.slug);
    // 所有官网明确标出的 ml 剂量按配方顺序逐一核对；IBA Tiki 的两行漏单位另有专门断言。
    const volumes = (values: string[]) => values.flatMap((value) => [...value.matchAll(/(\d+(?:\.\d+)?)\s*ml/gi)].map((match) => Number(match[1])));
    if (recipe.slug !== 'iba-tiki') {
      assert.deepEqual(volumes(catalog.ingredients.map((entry) => entry.amount)), volumes(recipe.ingredients), recipe.slug);
    }
    counts[recipe.iba_category] = (counts[recipe.iba_category] || 0) + 1;
  }
  assert.deepEqual(counts, { unforgettables: 34, contemporary_classics: 34, new_era: 34 });
  // 编辑稿绑定已审核的官方材料、方法与装饰原文；源配方变化必须先复核中文。
  execFileSync('python3', ['scripts/import-iba-catalog.py', '--check'], { cwd: root, stdio: 'pipe' });
});

test('扩容保留原 39 酒款与 68 原料的持久化 ID，兼容收藏和酒柜', () => {
  const legacyCocktails = 'whiskey-sour daiquiri pisco-sour new-york-sour bees-knees clover-club gin-fizz ramos-fizz french-75 john-collins cuba-libre moscow-mule dark-n-stormy horses-neck paloma mojito old-fashioned negroni boulevardier sazerac rusty-nail dry-martini manhattan espresso-martini black-russian hanky-panky sidecar margarita white-lady between-the-sheets cosmopolitan tommys-margarita spritz bellini mimosa pina-colada planters-punch americano aviation'.split(' ');
  const legacyIngredients = 'gin bourbon rye-whiskey scotch vodka citron-vodka white-rum goslings-rum jamaican-rum cognac pisco tequila sweet-vermouth dry-vermouth campari triple-sec coffee-liqueur drambuie absinthe fernet aperol maraschino violet-liqueur simple-syrup honey-syrup sugar sugar-cube raspberry-syrup agave-nectar lemon-juice lime-juice orange-juice cranberry-juice pineapple-juice peach-puree sugarcane-juice soda-water ginger-beer ginger-ale grapefruit-soda cola champagne prosecco red-wine cream coconut-cream egg-white orange-flower-water vanilla-extract angostura peychaud amargo espresso salt water orange-peel lemon-peel orange-slice lemon-slice lime-slice lime-wedge cocktail-cherry mint olive salt-rim coffee-beans pineapple-slice raspberry'.split(' ');
  const ingredientIds = new Set(builtinCatalog.ingredients.map((entry) => entry.id));
  assert.equal(legacyCocktails.length, 39);
  assert.equal(legacyIngredients.length, 68);
  for (const id of legacyCocktails) assert.ok(byId.has(id), id);
  for (const id of legacyIngredients) assert.ok(ingredientIds.has(id), id);
});

test('官方可选材料不阻挡制作，二选一基酒只选一个完整版本', () => {
  for (const id of ['whiskey-sour', 'illegal', 'south-side', 've-n-to']) {
    assert.equal(line(id, 'egg-white').is_essential, false, id);
  }
  assert.equal(line('champagne-cocktail', 'grand-marnier').is_essential, false);
  assert.equal(line('horses-neck', 'angostura').is_essential, false);
  assert.equal(line('rabo-de-galo', 'angostura').is_essential, false);
  assert.equal(line('clover-club', 'egg-white').is_essential, true);
  assert.equal(line('new-york-sour', 'egg-white').is_essential, true);
  for (const id of ['old-fashioned', 'boulevardier', 'new-york-sour']) {
    const whiskey = byId.get(id)!.ingredients.filter((entry) => ['bourbon', 'rye-whiskey'].includes(entry.ingredient_id));
    assert.equal(whiskey.length, 1, id);
    assert.equal(whiskey[0].is_essential, true, id);
  }
  assert.equal(byId.get('old-cuban')!.ingredients.filter((entry) => ['champagne', 'prosecco'].includes(entry.ingredient_id)).length, 1);
  assert.equal(line('porn-star-martini', 'champagne').amount, '50 ml，另杯随附');
});

test('保留完整官方配方，修正原站连写并明确原站漏单位的解释', () => {
  assert.equal(line('three-dots-and-a-dash', 'allspice-dram').amount, '7.5 ml');
  assert.equal(line('three-dots-and-a-dash', 'lime-juice').amount, '15 ml');
  assert.equal(line('mai-tai', 'martinique-molasses-rum').amount, '30 ml');
  assert.equal(byId.get('mai-tai')!.ingredients.some((entry) => entry.ingredient_id === 'martinique-agricole-rum'), false);
  assert.equal(line('iba-tiki', 'pineapple-juice').amount, '90 ml');
  assert.equal(line('iba-tiki', 'lime-juice').amount, '30 ml');
  const editorial = JSON.parse(readFileSync(path.join(root, 'server/data/iba-editorial.json'), 'utf8')) as {
    source_notes: Array<{ slug: string; issue: string; resolution: string }>;
  };
  assert.ok(editorial.source_notes.some((entry) => entry.slug === 'iba-tiki' && entry.issue.includes('omitting a unit')));
  assert.ok(official.cocktails.find((entry) => entry.slug === 'iba-tiki')!.ingredients.includes('90 Fresh Pineapple Juice'));
});
