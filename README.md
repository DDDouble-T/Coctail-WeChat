# 猫咪酒馆

面向家庭调酒爱好者的微信小程序：从后端浏览 IBA 全量酒谱，按材料匹配今晚能调的酒。收藏和酒柜保存在当前设备。

## 开发与验证

环境要求 Node.js 22+、微信开发者工具；更新官方数据时需要 Python 3 和 requests。

```sh
npm ci
npm run check
npm run server:build
npm run server:dev
```

本地 API 为 `http://localhost:8080/api/catalog`，未配置 TCB 时由后端读取全量快照。生产环境必须读取 TCB，数据库失败返回 503。小程序通过 `wx.cloud.callContainer` 访问 `miniprogram/config.ts` 配置的云托管服务，不再内置 39 款酒单；首次使用需要连接后端，成功后保留校验过的离线目录。酒款图片经同一云托管服务下载并缓存到设备，全部原图与蜡笔图随服务端发布。

微信开发者工具使用 `project.config.json` 的正式 AppID。若工具自身接口出现 `INVALID_TOKEN`，退出工具账号并扫码重新登录。

从内置酒单版本更新到后端目录后，如果启动时报 `normalizeIngredientIds` 的 `forEach of undefined`，先在开发者工具顶部“清缓存”中选择“清除编译缓存”，再点击“编译”。旧目录/匹配模块仍运行、而原料元数据已更新时，可复现该错误；当前源码会用空目录渲染并等待后端返回。若仍使用旧模块，关闭该项目的编译热重载，再关闭项目窗口并从当前仓库根目录重新打开；内存中的文件缓存也需要重新建立。只清编译缓存即可，酒柜和收藏无需清除。CLI 对应命令是 `cli cache --project <项目根目录> --clean compile`，要求开发者工具的服务端口可连接。

## TCB 初始化与部署

继续使用微信云托管 + TCB **文档数据库**，不需要 SQL 或 MySQL。先创建 `ingredients` 和 `cocktails` 两个集合，客户端权限设置为仅管理端可读写。

```sh
npm run db:export
# 控制台依次导入 server/tcb/ingredients.jsonl、server/tcb/cocktails.jsonl
# 或在已注入 TCB 写权限凭证的终端执行：
node --env-file=.env.local --import tsx server/src/seed.ts

npm run deploy:package
```

种子使用稳定文档 ID，可重复执行，保留数据库中额外新增的酒谱。部署包输出到 `artifacts/cat-tavern-tcb-deploy.tar.gz`，包含全量酒谱、TCB 导入数据和全部酒款图片。具体配置、发布命令与验收见 [部署说明](docs/deployment.md)，GitHub 自动构建绑定见 [原生流水线配置](docs/git-pipeline.md)。打包完成不代表已发布到云端。

卡片点击通过 `POST /api/cocktails/:id/clicks` 按酒谱累计，独立保存到 TCB `cocktail_stats` 集合。上线前需创建该集合并设置仅管理端可读写；酒谱初始化不会覆盖统计。普通卡片和今日特调成功打开详情各计一次，统计失败不影响浏览，详见部署说明。

## 数据与图片

`server/data/catalog.json` 是服务端完整目录；`data/iba-cocktails/recipes-source.json` 保存官方原文，`server/data/iba-editorial.json` 保存审核后的中文表达和材料映射。当前按 IBA 官网 sitemap 收录全部 102 款，官方新增或调整时通过以下命令更新并复核：

```sh
npm run iba:catalog -- --refresh
npm run iba:images
npm run db:export
npm run check
```

导入器会检查官方原料、做法和装饰是否变化；发生变化时必须复核中文数据后才能生成新目录。原图来源和摘要见 `data/iba-cocktails/manifest.json`。酒款图片仅存后端 `data/iba-cocktails/{originals,crayon}`，通过 `/media/cocktails/` 提供，不占小程序主包。
