import { cloudConfig } from '../config';

async function recordClick(id: string): Promise<void> {
  if (!wx.cloud?.callContainer || !cloudConfig.envId) return;
  try {
    const response = await wx.cloud.callContainer({
      config: { env: cloudConfig.envId },
      path: `/api/cocktails/${encodeURIComponent(id)}/clicks`, method: 'POST', timeout: 5000,
      header: { 'X-WX-SERVICE': cloudConfig.serviceName },
    });
    if (response.statusCode !== 204) console.error('[clicks] 点击统计失败', { statusCode: response.statusCode });
  } catch {
    // 统计尽力上报，不重试，避免响应丢失后重复计数，也不影响详情浏览。
    console.error('[clicks] 点击统计请求失败');
  }
}

export function openRecipe(id: string): void {
  if (!id) return;
  wx.navigateTo({
    url: `/pages/detail/index?id=${encodeURIComponent(id)}`,
    success() { void recordClick(id); },
  });
}
