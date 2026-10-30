import type { Family, IbaCategory, IngredientGroup, Style } from './types';

export const familyOptions: Array<{ id: Family | 'all'; label: string; english: string }> = [
  { id: 'all', label: '全部', english: 'All' },
  { id: 'sour', label: '酸酒', english: 'Sour' },
  { id: 'fizz', label: '菲兹', english: 'Fizz' },
  { id: 'collins', label: '柯林斯', english: 'Collins' },
  { id: 'highball', label: '高球', english: 'Highball' },
  { id: 'old_fashioned', label: '古典', english: 'Old Fashioned' },
  { id: 'martini', label: '马天尼', english: 'Martini' },
  { id: 'daisy', label: '黛西', english: 'Daisy' },
];

export const ingredientGroups: Array<{ id: IngredientGroup; label: string; english: string }> = [
  { id: 'base', label: '基酒', english: 'Spirits' },
  { id: 'liqueur', label: '利口酒与味美思', english: 'Liqueurs' },
  { id: 'syrup', label: '糖浆甜料', english: 'Sweeteners' },
  { id: 'citrus', label: '果汁与果泥', english: 'Fruit' },
  { id: 'mixer', label: '软饮与辅料', english: 'Mixers' },
  { id: 'garnish', label: '装饰与香草', english: 'Garnish & Herbs' },
];

export const styleLabels: Record<Style, string> = {
  shake: '摇和', stir: '搅拌', build: '杯中直调', blend: '搅打',
};

export const ibaLabels: Record<IbaCategory, string> = {
  unforgettables: '难忘经典', contemporary_classics: '当代经典', new_era: '新纪元',
};
