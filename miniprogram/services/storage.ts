const prefix = 'cat-tavern:v1:';
type ListName = 'bar' | 'favorites';

export function readList(name: ListName): string[] {
  try {
    const value: unknown = wx.getStorageSync(prefix + name);
    return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string'))] : [];
  } catch {
    wx.showToast({ title: '本地数据读取失败，请重试', icon: 'none' });
    return [];
  }
}

export function writeList(name: ListName, ids: readonly string[]): boolean {
  try {
    wx.setStorageSync(prefix + name, [...new Set(ids)]);
    return true;
  } catch {
    wx.showToast({ title: '保存失败，请检查设备存储空间', icon: 'none' });
    return false;
  }
}

export function toggleFavorite(id: string): boolean {
  const current = readList('favorites');
  return writeList('favorites', current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
}

