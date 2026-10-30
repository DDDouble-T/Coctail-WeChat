import { familyOptions } from '../../shared/catalog';
import { getDailyCocktail, normalizeIngredientIds } from '../../shared/matching';
import { catalogFailureNotice, getCatalog, refreshCatalog } from '../../services/catalog';
import { readList } from '../../services/storage';
import type { Cocktail, Ingredient } from '../../shared/types';
import { RecipeCard, toCard } from '../../utils/view-model';

Page({
  data: {
    families: familyOptions, selectedFamily: 'all', query: '', cards: [] as RecipeCard[],
    daily: { id: '', name: '', english: '', copy: '' },
    total: 0, notice: '', loading: true, version: '',
  },
  onShow() {
    this.render();
    void this.sync();
  },
  render() {
    const catalog = getCatalog();
    const owned = normalizeIngredientIds(readList('bar'), catalog.ingredients);
    const ingredientById = new Map(catalog.ingredients.map((ingredient) => [ingredient.id, ingredient]));
    const query = normalizeSearchText(this.data.query);
    const filtered = catalog.cocktails.filter((recipe) =>
      (this.data.selectedFamily === 'all' || recipe.family === this.data.selectedFamily) &&
      (!query || recipeSearchText(recipe, ingredientById).includes(query)),
    );
    const daily = getDailyCocktail(catalog.cocktails);
    this.setData({
      total: catalog.cocktails.length,
      version: catalog.version,
      cards: filtered.map((recipe) => toCard(recipe, owned)),
      daily: daily ? { id: daily.id, name: daily.name_zh, english: daily.name_en, copy: daily.healing_copy } : this.data.daily,
    });
  },
  async sync() {
    this.setData({ loading: true });
    const ok = await refreshCatalog();
    this.setData({ loading: false, notice: ok ? '' : catalogFailureNotice() });
    this.render();
  },
  async onPullDownRefresh() {
    try { await this.sync(); } finally { wx.stopPullDownRefresh(); }
  },
  selectFamily(event: WechatMiniprogram.TouchEvent) {
    this.setData({ selectedFamily: event.currentTarget.dataset.id as string });
    this.render();
  },
  search(event: WechatMiniprogram.Input) { this.setData({ query: event.detail.value }); this.render(); },
  clearSearch() { this.setData({ query: '', selectedFamily: 'all' }); this.render(); },
  openDaily() { if (this.data.daily.id) wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(this.data.daily.id)}` }); },
  openFavorites() { wx.navigateTo({ url: '/pages/collection/index?mode=favorites' }); },
  openBar() { wx.switchTab({ url: '/pages/bar/index' }); },
});

function recipeSearchText(
  recipe: Cocktail,
  ingredientById: ReadonlyMap<string, Ingredient>,
): string {
  const values = [recipe.name_zh, recipe.name_en];
  recipe.ingredients.forEach((line) => {
    values.push(line.name);
    const ingredient = ingredientById.get(line.ingredient_id);
    if (ingredient) values.push(ingredient.name_zh, ingredient.name_en, ...ingredient.aliases);
  });
  return normalizeSearchText(values.join(' '));
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9\u3400-\u9fff]+/g, '');
}
