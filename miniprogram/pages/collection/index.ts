import { getCatalog } from '../../services/catalog';
import { readList } from '../../services/storage';
import { normalizeIngredientIds } from '../../shared/matching';
import { RecipeCard, toCard } from '../../utils/view-model';

Page({
  data: { cards: [] as RecipeCard[] },
  onLoad() {
    wx.setNavigationBarTitle({ title: '我的收藏' });
  },
  onShow() { this.render(); },
  render() {
    const catalog = getCatalog();
    const owned = normalizeIngredientIds(readList('bar'), catalog.ingredients);
    const favorites = new Set(readList('favorites'));
    this.setData({
      cards: catalog.cocktails.filter((recipe) => favorites.has(recipe.id)).map((recipe) => toCard(recipe, owned)),
    });
  },
  goHome() { wx.switchTab({ url: '/pages/home/index' }); },
});
