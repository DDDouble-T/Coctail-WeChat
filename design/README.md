# 猫咪酒馆视觉资源

- `cat_coupe_icon@3x.png`：用户提供的原始图片，来源为 `/Users/tengteng/Downloads/cat_coupe_icon@3x.png`，保留原文件内容。
- `drinks/*.svg`：本项目绘制的六种猫咪鸡尾酒插画，可编辑矢量原稿，背景透明。
- `tabs/*.svg`：本项目绘制的底部导航图标原稿。

安装项目开发依赖后，执行 `node scripts/generate-assets.mjs`，可重新生成 `miniprogram/assets` 中的 PNG。原图保持完整，512 px 位图使用调色板压缩；饮品插画输出 400 × 400 px，导航图标输出 64 × 64 px。
