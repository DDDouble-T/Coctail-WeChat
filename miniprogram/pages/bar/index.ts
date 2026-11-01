import { ingredientGroups } from '../../shared/catalog';
import { matchCocktails, normalizeIngredientIds } from '../../shared/matching';
import { catalogFailureNotice, getCatalog, refreshCatalog } from '../../services/catalog';
import { readList, writeList } from '../../services/storage';
import { RecipeCard, toCard } from '../../utils/view-model';
import { IngredientGroup } from '../../shared/types';

const baseIngredientOrder = [/金酒/, /朗姆酒/, /威士忌/, /伏特加/, /龙舌兰/, /白兰地/, /.*/];

Page({
  data: {
    selected: [] as { id: string; name: string }[],
    groups: [] as { id: IngredientGroup; label: string; english: string; open: boolean; count: number; items: { id: string; name: string; english: string; selected: boolean }[] }[],
    openGroup: 'base', ownedCount: 0, readyCount: 0, cards: [] as RecipeCard[],
    notice: '', loading: true, total: 0, version: '',
  },
  onShow() {
    this.render();
    void this.sync();
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
  render() {
    const catalog = getCatalog();
    // 仅调整材料柜文案，保留配方中的具体酒种和匹配 ID。
    const ingredients = catalog.ingredients.map((item) => item.id === 'white-rum' ? { ...item, name_zh: '朗姆酒' } : item);
    const ids = normalizeIngredientIds(readList('bar'), catalog.ingredients);
    const owned = new Set(ids);
    const matches = owned.size ? matchCocktails(catalog.cocktails, ids, catalog.ingredients) : [];
    const visible = matches.filter((match) => match.missing_essential < 3);
    this.setData({
      total: catalog.cocktails.length, version: catalog.version,
      ownedCount: ids.length,
      selected: ingredients.filter((item) => owned.has(item.id)).map((item) => ({ id: item.id, name: item.name_zh })),
      groups: ingredientGroups.map((group) => {
        const items = ingredients.filter((item) => item.group === group.id).map((item) => ({ id: item.id, name: item.name_zh, english: item.name_en, selected: owned.has(item.id) }));
        if (group.id === 'base') {
          items.sort((left, right) => baseIngredientOrder.findIndex((pattern) => pattern.test(left.name)) - baseIngredientOrder.findIndex((pattern) => pattern.test(right.name)));
        }
        return { ...group, open: group.id === this.data.openGroup, count: items.filter((item) => item.selected).length, items };
      }),
      cards: visible.map((match) => toCard(match.cocktail, ids, true, match)),
      readyCount: matches.filter((match) => match.can_make).length,
    });
  },
  toggleGroup(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    const openGroup = this.data.openGroup === id ? '' : id;
    this.setData({
      openGroup,
      groups: this.data.groups.map((group) => ({ ...group, open: group.id === openGroup })),
    }, () => {
      // 等分类布局更新后再回顶，保持初始未滚动的位置。
      wx.pageScrollTo({ scrollTop: 0, duration: 200 });
    });
  },
  toggleIngredient(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string;
    const ids = normalizeIngredientIds(readList('bar'), getCatalog().ingredients);
    if (writeList('bar', ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])) this.render();
  },
  clearBar() {
    wx.showModal({ title: '清空材料柜？', content: '只移除已选材料，收藏会保留。', confirmText: '清空', confirmColor: '#B96532', success: (result) => { if (result.confirm && writeList('bar', [])) this.render(); } });
  },
  openFavorites() { wx.navigateTo({ url: '/pages/collection/index?mode=favorites' }); },
});
