import { RecipeCard } from '../../utils/view-model';

Component({
  properties: { card: { type: Object, value: {} as RecipeCard } },
  methods: {
    open() { wx.navigateTo({ url: `/pages/detail/index?id=${encodeURIComponent(this.data.card.id)}` }); },
  },
});
