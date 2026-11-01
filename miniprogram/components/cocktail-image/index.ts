import { invalidateImage, loadImage } from '../../services/images';

const observers = new WeakMap<object, WechatMiniprogram.IntersectionObserver>();
const imageKeys = new WeakMap<object, string>();

Component({
  properties: {
    path: { type: String, value: '' },
    version: { type: String, value: '' },
  },
  data: { localPath: '', failed: false, loading: false, visible: false, requestId: 0 },
  observers: {
    'path, version'(path: string, version: string) {
      // 页面重绘会再次下发相同属性；保留已显示图片及在途请求，避免切换 Tab 时闪烁。
      const key = JSON.stringify([path, version]);
      if (imageKeys.get(this) === key) return;
      imageKeys.set(this, key);
      this.setData({ localPath: '', failed: false, requestId: this.data.requestId + 1 });
      if (this.data.visible) void this.load();
    },
  },
  lifetimes: {
    ready() {
      try {
        const observer = this.createIntersectionObserver({});
        observers.set(this, observer);
        observer.relativeToViewport({ top: 300, bottom: 300 }).observe('.remote-image', (entry) => {
          if (entry.intersectionRatio <= 0) return;
          observer.disconnect();
          this.setData({ visible: true });
          void this.load();
        });
      } catch {
        this.setData({ visible: true });
        void this.load();
      }
    },
    detached() {
      observers.get(this)?.disconnect();
      observers.delete(this);
      imageKeys.delete(this);
      this.data.requestId++;
    },
  },
  methods: {
    async load() {
      const requestId = this.data.requestId + 1;
      this.setData({ loading: true, failed: false, requestId });
      const localPath = await loadImage(this.properties.path, this.properties.version);
      if (this.data.requestId !== requestId) return;
      this.setData({ localPath, failed: !localPath, loading: false });
    },
    retry() { if (!this.data.loading) void this.load(); },
    imageError() {
      invalidateImage(this.properties.path, this.properties.version);
      this.setData({ localPath: '', failed: true, loading: false });
    },
  },
});
