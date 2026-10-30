import { getCatalog, refreshCatalog } from '../../services/catalog';
import { readList, toggleFavorite, writeList } from '../../services/storage';
import { matchCocktails, normalizeIngredientIds } from '../../shared/matching';
import { Cocktail } from '../../shared/types';
import { ibaLabel } from '../../utils/view-model';
import { styleLabels } from '../../shared/catalog';

Page({
  recipeId: '',
  data: {
    recipe: null as Cocktail | null, found: true, favorite: false, iba: '', style: '', missingCount: 0,
    lines: [] as { id: string; name: string; amount: string; owned: boolean; garnish: boolean; optional: boolean }[],
  },
  onLoad(query: Record<string, string | undefined>) {
    this.recipeId = query.id || '';
    this.render();
    void refreshCatalog().then(() => this.render());
  },
  onShow() { if (this.recipeId) this.render(); },
  render() {
    const catalog = getCatalog();
    const recipe = catalog.cocktails.find((item) => item.id === this.recipeId);
    if (!recipe) { this.setData({ found: false, recipe: null }); return; }
    const ids = normalizeIngredientIds(readList('bar'), catalog.ingredients);
    const match = matchCocktails([recipe], ids)[0];
    this.setData({
      found: true, recipe, favorite: readList('favorites').includes(recipe.id),
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
  copySource() { if (this.data.recipe) wx.setClipboardData({ data: this.data.recipe.source_url }); },
  goHome() { wx.switchTab({ url: '/pages/home/index' }); },
});
