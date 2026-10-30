import { catalogFailureNotice, getCatalog, refreshCatalog } from '../../services/catalog';
import { readList, toggleFavorite, writeList } from '../../services/storage';
import { matchCocktails, normalizeIngredientIds } from '../../shared/matching';
import { Cocktail } from '../../shared/types';
import { ibaLabel } from '../../utils/view-model';
import { styleLabels } from '../../shared/catalog';

Page({
  recipeId: '',
  data: {
    recipe: null as Cocktail | null, found: true, favorite: false, iba: '', style: '', missingCount: 0,
    loading: true, notice: '', version: '',
    lines: [] as { id: string; name: string; amount: string; owned: boolean; garnish: boolean; optional: boolean }[],
  },
  onLoad(query: Record<string, string | undefined>) {
    this.recipeId = query.id || '';
    this.render();
    void this.sync();
  },
  onShow() { if (this.recipeId) this.render(); },
  async sync() {
    this.setData({ loading: true });
    const ok = await refreshCatalog();
    this.setData({ loading: false, notice: ok ? '' : catalogFailureNotice() });
    this.render();
  },
  async onPullDownRefresh() {
    try { await this.sync(); } finally { wx.stopPullDownRefresh(); }
  },
  render() {
    const catalog = getCatalog();
    const recipe = catalog.cocktails.find((item) => item.id === this.recipeId);
    if (!recipe) { this.setData({ found: false, recipe: null, version: catalog.version }); return; }
    const ids = normalizeIngredientIds(readList('bar'), catalog.ingredients);
    const match = matchCocktails([recipe], ids, catalog.ingredients)[0];
    this.setData({
      found: true, recipe, version: catalog.version, favorite: readList('favorites').includes(recipe.id),
      iba: ibaLabel(recipe), style: styleLabels[recipe.style], missingCount: match.missing_essential,
      lines: recipe.ingredients.map((line) => ({ id: line.ingredient_id, name: line.name, amount: line.amount, owned: ids.includes(line.ingredient_id), garnish: line.is_garnish, optional: line.amount.includes('可选') })),
    });
    wx.setNavigationBarTitle({ title: recipe.name_zh });
  },
  favorite() {
    if (!this.data.recipe) return;
    const next = !this.data.favorite;
    if (toggleFavorite(this.data.recipe.id)) { this.render(); wx.showToast({ title: next ? '已收藏，留给下次' : '已取消收藏', icon: 'none' }); }
  },
  toggleOwned(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    const ids = normalizeIngredientIds(readList('bar'), getCatalog().ingredients);
    if (writeList('bar', ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])) this.render();
  },
  goHome() { wx.switchTab({ url: '/pages/home/index' }); },
});
