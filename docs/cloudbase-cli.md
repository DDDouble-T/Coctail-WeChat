# CloudBase CLI 发布操作

后端使用微信云托管与 TCB 文档数据库。以下命令已于 2026-10-30 用 CloudBase CLI **3.8.10** 的实际 `--help` 核对；部署需要对目标环境有效的 CloudBase 登录身份与权限。

## 登录并确认目标服务

无需全局安装，统一通过以下形式调用。包包含多个可执行文件，直接执行 `npx @cloudbase/cli@3.8.10` 会报 `could not determine executable to run`。

```sh
npx -y --package @cloudbase/cli@3.8.10 tcb login --flow device
```

按终端给出的设备授权链接完成登录。微信开发者工具的登录状态与 CloudBase CLI 登录状态各自独立；不能直接复用 IDE 令牌。CLI 默认将凭证写入 `~/.config/.cloudbase/auth.json`，请勿复制到仓库、聊天或发布包。

先只读确认环境 `paw-inn-d9gixxkg3f894407e` 中是否已经存在项目配置使用的 `paw-inn` 容器服务：

```sh
npx -y --package @cloudbase/cli@3.8.10 tcb cloudrun list \
  --env-id paw-inn-d9gixxkg3f894407e \
  --service-name paw-inn \
  --server-type container \
  --page-size 100 --page-num 1
```

再查询服务详情，仅输出确认部署目标所需的字段。`detail` 原始响应可能包含环境变量，避免直接将完整响应复制到日志或聊天。

```sh
npx -y --package @cloudbase/cli@3.8.10 tcb cloudrun detail \
  --env-id paw-inn-d9gixxkg3f894407e \
  --service-name paw-inn --json \
  | python3 -c 'import json,sys; s=sys.stdin.read(); r=json.loads(s[s.index("{"):]); d=r.get("data",{}); b=d.get("BaseInfo",d); keys=("EnvId","ServerName","ServerType","Status","Port","CreatedTime","UpdatedTime"); print(json.dumps({k:b[k] for k in keys if k in b},ensure_ascii=False,indent=2))'
```

若列表没有该服务、服务名不同、环境不匹配或没有权限，先处理目标与权限问题。`cloudrun deploy` 对不存在的名称会自动创建服务，不能用它验证名称。环境地域以控制台为准；如需显式指定，在命令中添加全局参数 `--region 实际地域`，不要猜测环境地域。

## 初始化数据并发布

先按 [部署说明](deployment.md) 将全量目录写入 `ingredients`、`cocktails` 集合，校验写入数量与配方引用。已有 CloudBase CLI 登录时，可使用下面的 CLI 初始化脚本，无需另行配置 SDK 密钥；也可在 TCB 控制台导入生成的 JSON Lines 数据。CloudBase CLI 的登录凭证不会自动成为 `@cloudbase/node-sdk` 的本地运行身份，因此 `npm run db:seed` 是另一条需要已授权 SDK 运行身份的初始化路径。

```sh
npm run db:export

# 默认只校验本地数据并预览，不访问云端。
node scripts/seed-tcb-cli.mjs --env-id paw-inn-d9gixxkg3f894407e

# 先验证 1 条最终原料；单条写入后立即查询并逐字段核对。
node scripts/seed-tcb-cli.mjs --env-id paw-inn-d9gixxkg3f894407e \
  --collection ingredients --limit 1 --write

# 初始化全部原料和酒谱，再以只读模式核对全部记录。
node scripts/seed-tcb-cli.mjs --env-id paw-inn-d9gixxkg3f894407e --write
node scripts/seed-tcb-cli.mjs --env-id paw-inn-d9gixxkg3f894407e --verify
```

脚本复用共享酒谱校验器，读取 `server/tcb/ingredients.jsonl` 与 `cocktails.jsonl`。它按稳定 `_id` 逐条 upsert，不删除额外记录；每请求仅发送 1 条、每条最多 32 KiB，是脚本的保守限制。公开 `RunCommands` 文档未列出单次文档数量或大小上限，不将其他 SDK 的限制套用到该接口。任一写入确认、内层错误或读回对比失败都会停止，已完成的记录可幂等重试。

脚本要求集合已存在。首次初始化可通过 CLI 通用云 API 创建；先运行 `ListTables` 核对，避免将权限错误误判为集合不存在。

```sh
npx -y --package @cloudbase/cli@3.8.10 tcb api tcb ListTables \
  --env-id paw-inn-d9gixxkg3f894407e \
  --body '{"EnvId":"paw-inn-d9gixxkg3f894407e","MgoLimit":100,"MgoOffset":0}' --json

npx -y --package @cloudbase/cli@3.8.10 tcb api tcb CreateTable \
  --env-id paw-inn-d9gixxkg3f894407e \
  --body '{"EnvId":"paw-inn-d9gixxkg3f894407e","TableName":"ingredients"}' --json
```

仅当目标集合尚不存在时执行创建；`cocktails` 集合使用相同形式。创建后的客户端规则需设为 `ADMINONLY`，小程序只经后端访问目录：

```sh
npx -y --package @cloudbase/cli@3.8.10 tcb api tcb ModifySafeRule \
  --env-id paw-inn-d9gixxkg3f894407e \
  --body '{"EnvId":"paw-inn-d9gixxkg3f894407e","CollectionName":"ingredients","AclTag":"ADMINONLY"}' --json

npx -y --package @cloudbase/cli@3.8.10 tcb api tcb DescribeSafeRule \
  --env-id paw-inn-d9gixxkg3f894407e \
  --body '{"EnvId":"paw-inn-d9gixxkg3f894407e","CollectionName":"ingredients"}' --json
```

对 `cocktails` 同样设置并读回确认。`ADMINONLY` 禁止客户端直接读写，已授权的管理身份仍可初始化和查询。`UpdateTable` 用于索引，不用于修改安全规则。

本次核对的 CLI `db nosql` 提供 `execute`、`backup`、`dump`，没有直接读取本地 JSON 文件的 `import` 命令。上述脚本使用 `execute` 的 `MgoCommands` JSON；每条 `CommandType` 为 `UPDATE`，命令为 `update` + 精确 `_id` 查询 + `$set` + `upsert: true`，字符串通过 `JSON.stringify` 编码并以 `execFile` 参数传递。

将已验证的发布包解压到独立目录，下面以 `artifacts/cat-tavern-deploy` 为例。此目录顶层必须有 `Dockerfile`，且包含它引用的所有构建输入；未检测到 Dockerfile 时，CLI 可能将新服务识别为函数服务。

```sh
npx -y --package @cloudbase/cli@3.8.10 tcb cloudrun deploy \
  --env-id paw-inn-d9gixxkg3f894407e \
  --service-name paw-inn \
  --source artifacts/cat-tavern-deploy \
  --port 80 \
  --wait --yes
```

该命令更新已确认的服务，并等待发布结果。默认发布成功后切换业务流量；需要先部署再手工切流时使用 `--traffic`，并移除 `--wait`。部署前先在控制台核对现有服务的访问策略、资源规格、运行身份和数据库读取权限，按实际需要补充参数。

发布环境应具备以下运行配置，具体值以实际环境为准：

| 配置项 | 值或要求 |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | `80`，与服务监听端口一致 |
| `CLOUD_BASE_ENV_ID` | `paw-inn-d9gixxkg3f894407e`，先确认确为目标环境 |
| `TENCENTCLOUD_REGION` | 目标 TCB 环境的实际地域 |
| `TRUST_PROXY_HOPS` | 按实际网关配置，默认 `0` |
| `CLOUDBASE_APIKEY` | 目标环境的服务端 `api_key`，通过平台环境变量注入；不能使用客户端 `publish_key` |

普通云托管容器不能假定具有云函数临时身份。本仓库在 `ServerConfig` 中显式读取 `CLOUDBASE_APIKEY`，并在初始化 `@cloudbase/node-sdk` 时传入 `accessKey`，避免 SDK 版本间环境变量读取行为不同而导致数据库请求失败。CLI 登录身份不代替该运行凭证。当前使用的环境级 API Key 有效期至 2027-10-30，应在到期前通过平台配置轮换；不要将 Key 写入 Git、发布包或小程序。

部署命令有意省略 `--env-params`：对已有服务，省略会保留线上环境变量；传入 JSON 会**整体覆盖**，传 `{}` 会清空。需要修改变量时在控制台逐项核对，或提供包含全部所需变量的完整 JSON；不要将凭证写入命令历史。

发布后校验 `/healthz`、`/readyz`、`/api/catalog` 与后端图片地址。`/readyz` 必须实际读取 TCB 成功，目录应包含全部 102 款 IBA 鸡尾酒。验证通过后，再让小程序使用确认过的环境 ID 与服务名。

## 初始环境调查（登录前）

- 微信开发者工具已安装；它的 `cloud` 子命令仅支持环境查询与云函数操作，没有云托管容器发布或集合文件导入命令。
- `cli islogin --project /Users/tengteng/WeChatProjects/Coctail-WeChat` 连接现有 IDE 端口时返回 `wait IDE port timeout`，未能确认 IDE 登录状态。官方要求先在开发者工具的“设置 → 安全设置”开启服务端口。
- CLI 帮助命令只会初始化配置目录，不能据此认为已经登录。应通过正式设备授权流程取得登录身份，再执行只读查询确认目标环境权限。
- 已核对 `login`、`cloudrun list`、`cloudrun detail`、`cloudrun deploy`、`db nosql`、`db nosql execute` 的实际帮助，全部正常退出。无有效部署身份时不能发布。

官方参考：[CloudBase CLI 安装](https://docs.cloudbase.net/cli-v1/install)、[CLI 登录认证](https://docs.cloudbase.net/cli-v1/login)、[微信开发者工具命令行](https://developers.weixin.qq.com/miniprogram/dev/devtools/cli.html)、[文档数据库 RunCommands](https://cloud.tencent.com/document/api/876/129012)。
