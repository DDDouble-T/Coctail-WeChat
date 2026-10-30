import { catalogFailureNotice, getCatalog, refreshCatalog } from '../../services/catalog';
import { readList } from '../../services/storage';
import { normalizeIngredientIds } from '../../shared/matching';
import { RecipeCard, toCard } from '../../utils/view-model';

Page({
  data: { cards: [] as RecipeCard[], loading: true, notice: '', total: 0, version: '' },
  onLoad() {
    wx.setNavigationBarTitle({ title: '我的收藏' });
  },
  onShow() { this.render(); void this.sync(); },
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
    const owned = normalizeIngredientIds(readList('bar'), catalog.ingredients);
    const favorites = new Set(readList('favorites'));
    this.setData({
      total: catalog.cocktails.length, version: catalog.version,
      cards: catalog.cocktails.filter((recipe) => favorites.has(recipe.id)).map((recipe) => toCard(recipe, owned)),
    });
  },
  goHome() { wx.switchTab({ url: '/pages/home/index' }); },
});
