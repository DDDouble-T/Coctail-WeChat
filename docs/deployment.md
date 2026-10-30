# 微信云托管 + TCB 部署

后端采用 Node.js 22 + Express + CloudBase Node SDK。酒谱和原料存于 TCB 文档数据库，小程序通过 `wx.cloud.callContainer` 获取 API 与图片。酒柜、收藏保存在小程序本机。

## 1. 准备环境

当前小程序配置的云环境为 `paw-inn-d9gixxkg3f894407e`，服务名为 `paw-inn`。发布前应在微信云托管控制台确认这两项属于目标小程序，并确认环境地域。AppID 不能代替环境 ID。

在 TCB 创建 `ingredients`、`cocktails` 两个集合，使用稳定业务 ID 作为文档 `_id`。集合客户端权限设为仅管理端可读写；自定义规则为 `{"read":false,"write":false}`。普通 CloudBase 容器需要显式配置本环境的服务端 API Key（`CLOUDBASE_APIKEY`）；当前 SDK 不会自动获得容器数据库身份。服务器将该值显式传入 SDK 的 `accessKey`。不要使用客户端 `publish_key`，也不要把管理密钥交给小程序。初始化可使用已登录的 CLI，避免另配全账号密钥。

| 变量 | 配置 |
| --- | --- |
| `CLOUD_BASE_ENV_ID` | `paw-inn-d9gixxkg3f894407e`，按实际环境确认 |
| `TENCENTCLOUD_REGION` | `ap-shanghai`，以实际环境为准 |
| `CLOUDBASE_APIKEY` | 本环境的服务端 `api_key`，在平台环境变量中注入 |
| `NODE_ENV` | `production` |
| `PORT` | `80` |
| `TENCENTCLOUD_SECRETID` / `TENCENTCLOUD_SECRETKEY` | 本机初始化时可注入；云托管优先使用运行身份 |
| `TENCENTCLOUD_SESSIONTOKEN` | 使用临时凭证时同时配置 |
| `TRUST_PROXY_HOPS` | 默认 `0`；确认平台清理伪造转发头且仅一层可信代理时设 `1` |

当前部署使用环境级服务端密钥 `paw-inn-backend`，有效期至 **2027-10-30 20:09（上海时间）**，到期前应在平台轮换。它只保存在平台及本机忽略文件，流水线更新服务时须保留 `CLOUDBASE_APIKEY`；不要用不含该值的完整变量 JSON 覆盖线上配置。

真实凭证只放本机忽略文件 `.env.local` 或平台密钥配置，不放小程序、Git、构建参数、镜像或部署包。

## 2. 初始化 TCB 数据

TCB 文档库不执行 SQL。两种初始化方式任选一种：

**控制台导入**：运行 `npm run db:export`，先将 `server/tcb/ingredients.jsonl` 导入 `ingredients`，再将 `server/tcb/cocktails.jsonl` 导入 `cocktails`。选择 JSON 按行导入；文件已包含稳定 `_id`，更新已有数据时选择同 ID 覆盖，避免随机文档 ID 造成重复。不要清空集合，数据库里自建的其他文档可以保留。

**服务端脚本**：复制 `server/.env.example` 为根目录 `.env.local`，填入目标环境和受控凭证，然后执行：

```sh
npm ci
node --env-file=.env.local --import tsx server/src/seed.ts
```

脚本在写入前校验全量快照，按稳定 ID 执行 `doc(id).set(record)`；反复执行不会新增重复记录，不删除后台自建记录，会覆盖相同 ID 的业务字段。中途失败时修复权限或网络后重跑。HTTP 服务不自动写数据库，也不提供公开初始化接口。

导入的每款酒包含中文和英文名称、IBA 分组、材料剂量、角色、制作步骤及官方来源。当前全量为 102 款；图片字段指向后端 `/media/cocktails/crayon/...` 和 `/media/cocktails/originals/...`，图片二进制不存入数据库。

## 3. 构建与发布

先执行完整验证、生成导入文件和部署包：

```sh
npm run check
npm run server:build
npm run db:export
npm run deploy:package
```

输出 `artifacts/cat-tavern-tcb-deploy.tar.gz`。解压后的目录是构建上下文，使用与仓库相同的根目录 `Dockerfile`。包中包含全量目录、TCB 导入文件、102 张蜡笔图和 102 张原图，不包含本机密钥。微信云托管控制台上传该目录并使用顶层 Dockerfile，监听端口设为 `80`，注入上一节环境变量。

若直接从仓库构建，使用仓库根目录作为上下文：

```sh
docker build -t cat-tavern-api .
docker run --rm --env-file .env.local -e NODE_ENV=production -e PORT=80 -p 8080:80 cat-tavern-api
```

服务只执行已编译的 `dist/server/src/index.js`。生产模式缺少 TCB 环境 ID 会拒绝启动；数据库异常返回 503，不会回退到演示目录。

CloudBase CLI 发布方法见 [CLI 说明](cloudbase-cli.md)。需要真实登录身份才能查询现有服务和发布版本；微信开发者工具登录不等于 CloudBase CLI 登录。先核对现有服务，再部署，避免误建新服务。上线前配置就绪检查 `/readyz`，仅就绪后切换流量。

## 4. 小程序接入与图片

`miniprogram/config.ts` 配置云环境和服务名，启动时初始化云能力。首次进入页面获取 `/api/catalog`；成功后缓存远端目录。旧的 39 款目录缓存已失效；连接失败显示加载失败或已缓存的目录，支持重新加载。

图片同样经 `wx.cloud.callContainer` 获取二进制并写入设备缓存，避免依赖额外图片域名。云托管需要允许小程序访问 `/api/*` 和 `/media/cocktails/*`。图片失败显示占位；首次加载需联网。图片样式保留 `aspectFill` 撑满裁剪。小程序包只保留界面图标、猫咪 IP 和通用占位资源。

公开只读接口：

| 接口 | 用途 |
| --- | --- |
| `GET /healthz` | 进程存活，不依赖数据库 |
| `GET /readyz` | 绕过目录缓存检查 TCB 数据，失败为 503 |
| `GET /api/catalog` | `{ data: { version, cocktails, ingredients } }` |
| `GET /api/cocktails/:id` | 酒谱详情；无效 ID 返回 400，不存在返回 404 |
| `GET /media/cocktails/crayon/:filename` | 蜡笔图 |
| `GET /media/cocktails/originals/:filename` | 原图 |

API 默认每个连接 IP 每分钟 120 次，静态图片和健康探针不占 API 限额。多实例时按实例限流；生产网关需按实际代理配置，否则共享出口可能共用额度。

## 5. 发布验收

1. `/healthz`、`/readyz` 返回 200，`mode` 为 `cloud`。
2. `/api/catalog` 的 `X-Catalog-Source` 为 `cloud`，包含全部 102 款和有效原料引用；超过 100 条仍完整读取。
3. 从目录中取图片路径，经同一云托管访问，确认返回 `image/webp` 和图片内容。
4. 真机搜索新增酒款、打开详情、调整酒柜、收藏并重启核对数据。弱网/断网显示缓存或重试提示，恢复网络后可重新加载。
5. TCB 不可用时 `/readyz` 和业务 API 返回 503；修复后恢复，不输出虚假成功。

本地测试和部署包不能代替真实环境的权限、容器构建与微信网关验证。云端发布结果以实际调用和探针结果为准。

## 6. 本次发布结果

2026-10-30，服务 `paw-inn` 已完成真实云端构建并上线，API 地址为 <https://paw-inn-338302-10-1521020086.sh.run.tcloudbase.com>。`scripts/verify-backend.mjs` 已验证健康与就绪探针、TCB 数据源、全部 102 款官方酒谱、162 种原料、详情及后端原图/处理图。264 条文档已逐条写入并读回一致，两个集合均为 `ADMINONLY`。

GitHub 原生流水线配置与查询见 [流水线说明](git-pipeline.md)。小程序真实设备/开发者工具运行验证仍需完成，本机 IDE CLI 当前因服务端口超时无法自动验收。
