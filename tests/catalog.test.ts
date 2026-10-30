import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { CATALOG_VERSION, cocktails, ingredients } from '../server/src/builtin';
import { familyOptions, ibaLabels, ingredientGroups, styleLabels } from '../miniprogram/shared/catalog';
import { normalizeIngredientIds } from '../miniprogram/shared/matching';

test('后端目录覆盖全量 IBA 配方且每个产品家族均可浏览', () => {
  assert.ok(CATALOG_VERSION.length > 0);
  assert.equal(cocktails.length, 102);
  assert.equal(new Set(cocktails.map((entry) => entry.id)).size, cocktails.length);
  assert.equal(familyOptions.length, 8);

  for (const family of familyOptions.filter((entry) => entry.id !== 'all')) {
    assert.ok(cocktails.some((entry) => entry.family === family.id), family.id);
  }
  for (const cocktail of cocktails) {
    assert.ok(cocktail.name_zh && cocktail.name_en && cocktail.taste && cocktail.healing_copy && cocktail.glass, cocktail.id);
    assert.ok(cocktail.ingredients.length >= 2 && cocktail.steps.length >= 1, cocktail.id);
    assert.ok(cocktail.ingredients.some((line) => line.is_essential), cocktail.id);
    assert.ok(ibaLabels[cocktail.iba_category] && styleLabels[cocktail.style], cocktail.id);
    assert.equal(cocktail.image_url, `/media/cocktails/crayon/${cocktail.id}-crayon.webp`);
    assert.match(cocktail.image_original_url, /^\/media\/cocktails\/originals\//);
    const imagePath = path.join(process.cwd(), 'data/iba-cocktails', cocktail.image_url.replace('/media/cocktails/', ''));
    assert.ok(existsSync(imagePath), `${cocktail.id} 蜡笔图必须随后端发布`);
    assert.equal(cocktail.source_url, `https://iba-world.com/iba-cocktail/${cocktail.id}/`);
  }
  assert.equal(existsSync(path.join(process.cwd(), 'miniprogram/assets/cocktails')), false);
});

test('IBA sitemap 的 102 张原图及蜡笔图完整，manifest 原图摘要有效', () => {
  const manifestPath = path.join(process.cwd(), 'data/iba-cocktails/manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    filter: string;
    cocktails: Array<{ slug: string; original_file: string; crayon_file: string; original_sha256: string }>;
  };
  assert.equal(manifest.filter, 'crayon-v1');
  assert.equal(manifest.cocktails.length, 102);
  assert.equal(new Set(manifest.cocktails.map((entry) => entry.slug)).size, 102);
  for (const entry of manifest.cocktails) {
    const original = path.join(process.cwd(), 'data/iba-cocktails', entry.original_file);
    const crayon = path.join(process.cwd(), 'data/iba-cocktails', entry.crayon_file);
    assert.ok(existsSync(original), `${entry.slug} 原图缺失`);
    assert.ok(existsSync(crayon), `${entry.slug} 蜡笔图缺失`);
    assert.equal(createHash('sha256').update(readFileSync(original)).digest('hex'), entry.original_sha256, `${entry.slug} 原图摘要不匹配`);
  }
});

test('全部配料归一为真实字典项，名称、分组与角色一致', () => {
  const dictionary = new Map(ingredients.map((entry) => [entry.id, entry]));
  const groups = new Set(ingredientGroups.map((entry) => entry.id));
  assert.equal(dictionary.size, ingredients.length);
  for (const item of ingredients) {
    assert.ok(groups.has(item.group), item.id);
    for (const alias of [item.id, item.name_zh, item.name_en, ...item.aliases]) {
      assert.deepEqual(normalizeIngredientIds([alias], ingredients), [item.id], `${item.id}: ${alias}`);
    }
  }
  for (const cocktail of cocktails) {
    assert.equal(new Set(cocktail.ingredients.map((line) => line.ingredient_id)).size, cocktail.ingredients.length, cocktail.id);
    for (const line of cocktail.ingredients) {
      const item = dictionary.get(line.ingredient_id);
      assert.ok(item, `${cocktail.id}: ${line.ingredient_id}`);
      assert.equal(line.name, item.name_zh);
      assert.ok(line.amount.length > 0);
      assert.ok(!(line.is_essential && line.is_garnish), cocktail.id);
      if (item.group === 'base') assert.equal(line.is_essential, true, `${cocktail.id}: 基酒不能可选`);
    }
  }
});

test('保留 IBA 官方容易误录的关键用量与材料，不用常见变体覆盖', () => {
  const find = (id: string) => {
    const recipe = cocktails.find((entry) => entry.id === id);
    assert.ok(recipe, id);
    return recipe;
  };
  const amount = (id: string, ingredientId: string) => find(id).ingredients.find((line) => line.ingredient_id === ingredientId)?.amount;
  assert.equal(amount('whiskey-sour', 'bourbon'), '45 ml');
  assert.equal(amount('whiskey-sour', 'lemon-juice'), '25 ml');
  assert.equal(amount('daiquiri', 'sugar'), '2 吧勺');
  assert.equal(amount('bees-knees', 'orange-juice'), '22.5 ml');
  assert.equal(amount('bees-knees', 'honey-syrup'), '2 茶匙');
  assert.equal(amount('ramos-fizz', 'vanilla-extract'), '2 滴');
  assert.equal(amount('cosmopolitan', 'citron-vodka'), '40 ml');
  assert.equal(amount('paloma', 'grapefruit-soda'), '100 ml');
  assert.equal(find('paloma').ingredients.find((line) => line.ingredient_id === 'salt')?.is_essential, true);
  assert.equal(amount('espresso-martini', 'coffee-liqueur'), '30 ml');
  assert.equal(amount('planters-punch', 'sugarcane-juice'), '30 ml');
  assert.equal(find('white-lady').ingredients.some((line) => line.ingredient_id === 'egg-white'), false);
  assert.ok(find('mojito').ingredients.some((line) => line.ingredient_id === 'mint' && line.is_essential && !line.is_garnish));
  assert.ok(find('new-york-sour').ingredients.some((line) => line.ingredient_id === 'red-wine' && line.is_essential));
});
