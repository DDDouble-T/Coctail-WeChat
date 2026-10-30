import { cloudConfig } from './config';

App({
  onLaunch() {
    if (cloudConfig.envId && wx.cloud) {
      wx.cloud.init({ env: cloudConfig.envId, traceUser: false });
    }
  },
});
