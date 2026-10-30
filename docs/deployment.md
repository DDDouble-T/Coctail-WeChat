# 云托管 + TCB 部署

服务采用 Node.js 22 + Express，酒谱与原料存于同一 CloudBase（TCB）环境的文档数据库。小程序通过 `wx.cloud.callContainer` 调用云托管，不直接访问数据库。本期接口为公开酒谱查询，酒柜、收藏、历史记录在小程序本机保存。

## 1. 本地验证

在仓库根目录执行：

```sh
npm ci
npm test
npm run typecheck
npm run server:build
npm run server:dev
```

默认监听 `http://localhost:8080`。没有配置 `CLOUD_BASE_ENV_ID` 时使用完整内置酒谱，可先开发小程序界面；响应头 `X-Catalog-Source: builtin` 可识别该模式。配置环境 ID 后，读取 TCB 失败会返回 `503`，不会假装已从远端读取成功。生产模式缺少环境 ID 会直接拒绝启动。

`server/.env.example` 是配置说明，命令不会自动加载它。需要本地连接 TCB 时，可复制为未追踪的 `.env.local`，填写实际值后执行：

```sh
node --env-file=.env.local --import tsx server/src/index.ts
```

Node.js 20.6+ 支持 `--env-file`；项目推荐 Node.js 22。真实密钥只能放本机未追踪文件或平台密钥管理，不放小程序、仓库、Docker 构建参数或镜像。

## 2. 创建环境和数据库

1. 用实际小程序 AppID 开通微信云托管，并创建或关联 TCB 环境。记下**环境 ID**、地域和**云托管服务名**；这三项不能用 AppID 代替。
2. 在该环境创建 `ingredients`、`cocktails` 两个文档集合。采用空白模板即可，文档 ID 使用业务 ID；没有额外复合索引要求，服务按 `_id` 分页读取完整集合。
3. 两个集合的客户端权限设置为「仅管理端可读写」；如使用自定义规则，设置 `{"read":false,"write":false}`。服务器通过具备权限的运行身份访问，禁止为方便调试给小程序开放数据库写权限。
4. 为云托管运行身份授予目标环境所需的 TCB 数据库读取权限。推荐将初始化写权限限定给运维或单独的初始化身份。优先使用平台提供的临时身份；若实际环境不支持自动获取，则通过平台密钥配置注入所需凭证。

服务配置：

| 变量 | 用途 |
| --- | --- |
| `CLOUD_BASE_ENV_ID` | 必填，实际 TCB 环境 ID |
| `TENCENTCLOUD_REGION` | TCB 环境所在地域，如 `ap-shanghai` |
| `PORT` | 云托管设 `80`；本地默认 `8080` |
| `NODE_ENV` | 云托管设 `production` |
| `TENCENTCLOUD_SECRETID` / `TENCENTCLOUD_SECRETKEY` | 仅外部运行或平台确需时注入；成对配置 |
| `TENCENTCLOUD_SESSIONTOKEN` | 临时凭证时同时配置；不要把临时凭证永久写入配置 |
| `TRUST_PROXY_HOPS` | 默认 `0`；确认平台清理伪造转发头、且请求经过一个可信网关后可设 `1` |

默认每个连接 IP 对 `/api` 限制 120 次/分钟；健康探针不受影响。信任代理层数必须与实际网络一致，否则可能共享额度或允许伪造 IP。若多实例扩容，此额度按实例生效，需要全局额度时在云托管网关设置。

## 3. 显式初始化数据

发布小程序前先运行 `npm run iba:images`。脚本从 IBA 官方 sitemap 逐页提取鸡尾酒主图，保留原图并生成确定性的蜡笔效果图；现有目录的图写入 `miniprogram/assets/cocktails/`，全量原图、处理图和来源清单保存在 `data/iba-cocktails/`。酒谱文档的 `image_url` 指向小程序包内图片，`image_original_url` 和 `source_url` 保留官方来源。图片二进制不写入文档数据库，避免大字段和重复存储。

先确认环境 ID 指向预期环境，然后用具备写权限的本机或受控作业注入凭证：

```sh
node --env-file=.env.local --import tsx server/src/seed.ts
```

也可在已注入环境变量的受控终端执行 `npm run db:seed`。脚本校验内置数据后，对两个集合按稳定 `id` 执行 `doc(id).set(record)`；可重复执行，不产生重复记录，也不会删除数据库里额外新增的酒谱。它会覆盖同 ID 的业务字段，手工编辑过数据时需先确认是否需要保留。中途失败可修复权限/网络后重跑。

HTTP 服务不会自动初始化数据库，也没有公开初始化或管理路由。新增原料时先写原料，再写引用该原料的酒谱；完整酒谱需包含中文/英文名称、分类、配方、步骤和来源链接。数据无效或引用断裂时 API 返回 `503`，在后台修复后会恢复。

## 4. 构建和发布容器

Docker 构建上下文必须是**仓库根目录**，Dockerfile 路径选 `server/Dockerfile`：

```sh
docker build -f server/Dockerfile -t cat-tavern-api .
docker run --rm --env-file .env.local -e PORT=80 -p 8080:80 cat-tavern-api
```

该镜像使用 Node.js 22；也可在平台支持时切换为 Node.js 20 的相应镜像，并重新执行验证。镜像只运行已编译的服务代码，启动入口为 `node dist/server/src/index.js`。构建需要联网安装 npm 依赖，镜像不包含 `.env*` 和本地项目私有配置。

云托管服务设置容器监听端口 `80`，配置上述环境变量，启用适合当前流量的实例规格。发布前先完成数据库初始化。HTTP 存活探针用 `/healthz`，就绪探针用 `/readyz`：前者只检查进程，后者跳过缓存实际读取并校验 TCB 两个集合；成功后才切换业务流量。

小程序通过微信网关访问时，按平台当前控制台配置授权小程序 AppID 与服务调用关系，并优先关闭公网匿名入口。仅为外部联调临时开放公网时，也只提供本期公开的只读酒谱 API。任何客户端自填的 `X-WX-OPENID` / `X-WX-FROM-OPENID` 都不构成服务端鉴权；将来加入账号写操作时，必须使用可信平台网关的身份并实施资源授权。

## 5. 小程序连接真实服务

在微信开发者工具中打开仓库根目录，改为自己的 AppID；将小程序配置中的演示模式切换为云模式，填写上述环境 ID 和云托管服务名。调用模式为：

```ts
wx.cloud.init({ env: '实际环境ID', traceUser: false });
wx.cloud.callContainer({
  config: { env: '实际环境ID' },
  path: '/api/catalog',
  method: 'GET',
  header: { 'X-WX-SERVICE': '实际云托管服务名' },
});
```

`/api/catalog` 返回 `{ data: { version, cocktails, ingredients } }`；`/api/cocktails/:id` 返回 `{ data: Cocktail }`。失败时返回 `{ error: { code, message } }` 和正确 HTTP 状态码。前端的云模式必须处理请求失败并明确展示离线缓存状态，不将内置演示数据标为云端数据。

## 6. 发布验证

- `/healthz` 返回 `200`，`mode` 为 `cloud`。
- `/readyz` 返回 `200`；权限错误、未初始化数据或数据库不可用时应为 `503`。
- `/api/catalog` 返回完整酒谱，响应头 `X-Catalog-Source` 为 `cloud`；超过 100 条仍能完整返回。
- 真机进入酒谱列表、查看详情、调整酒柜并核对「可调 / 差 1 款」结果，验证收藏和历史在重启后保留。
- 弱网或断网后确认显示缓存/失败提示；恢复网络后可重试。

仓库测试会覆盖 API 行为、分页、云依赖失败、无效云数据、缓存失效和请求限制。真实云权限、微信网关、真机布局和发布审核必须使用你的账号环境验证；当前代码不包含账号凭证，也未替你创建或发布远端资源。

SDK 用法依据：[CloudBase Node SDK](https://github.com/TencentCloudBase/node-sdk)、[数据库 get / set / 分页说明](https://github.com/TencentCloudBase/node-sdk/blob/master/docs/database/database.md)、[初始化和服务端凭证](https://docs.cloudbase.net/api-reference/server/node/initialize)。
