# 猫咪酒馆

一个面向家庭调酒爱好者的微信小程序 MVP：第一 Tab 是「调酒配方」，按酒款家族浏览、搜索和查看今日特调；第二 Tab 是「我的酒吧」，勾选材料后按匹配度找出今晚能调的配方。收藏和材料柜保存在当前设备，不建立账号也能使用。

## 本地开发

环境要求：Node.js 20+（推荐 22）和微信开发者工具。

```sh
npm ci
npm run check
npm run assets
npm run iba:images
```

在微信开发者工具中打开仓库根目录，将 `project.config.json` 的 `appid` 换成自己的 AppID。`miniprogram/config.ts` 留空时使用内置 39 款 IBA 酒谱；输入云环境 ID 和云托管服务名后，启动时会尝试更新目录，失败会保留本地可用目录并提示。`npm run iba:images` 可重新抓取 IBA 官方 sitemap 中的鸡尾酒图片，输出原图、蜡笔效果图和来源清单；其中目录已有的 39 款图片会进入小程序资源包。

本地调试仍使用 `project.config.json` 中的正式 AppID，只需保持 `miniprogram/config.ts` 的 `envId` 为空即可使用内置酒谱，不需要切换游客身份。`project.private.config.json` 会覆盖公共配置，避免在其中设置不同的 AppID。开发者工具自身接口报 `INVALID_TOKEN` 时，需要退出工具账号并扫码重新登录，关闭并重新打开项目；切换本地酒谱不会刷新工具凭证。

## 服务端

```sh
npm run server:dev
# GET http://localhost:8080/healthz
# GET http://localhost:8080/api/catalog
```

后端是 Express + `@cloudbase/node-sdk`。没有 `CLOUD_BASE_ENV_ID` 时为本地内置模式；生产环境必须配置真实 TCB 环境 ID，云数据库异常返回 503，不会静默回退。TCB 集合初始化由显式命令完成：

```sh
node --env-file=.env.local --import tsx server/src/seed.ts
```

云托管、集合权限、密钥和发布步骤见 [docs/deployment.md](docs/deployment.md)。服务端只读酒谱 API，不接收客户端自填的 OpenID 作为鉴权；用户材料仍只在小程序本地保存。

## 目录

- `miniprogram/shared/`：类型、39 款配方、材料归一化和匹配算法。
- `miniprogram/pages/`：调酒配方、我的酒吧、详情和收藏页面。
- `miniprogram/assets/cocktails/`：39 款配方使用的蜡笔滤镜图；`data/iba-cocktails/`：IBA 全站 102 款原图、处理图和来源摘要。
- `server/`：云托管服务、TCB 数据访问和幂等 seed 脚本。
- `design/`、`miniprogram/assets/`：猫咪 IP 原图、可编辑插画和压缩后的运行资源。
- `tests/`：配方、匹配、API、TCB 失败路径和 seed 测试。
