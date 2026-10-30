# 微信云托管 Git 原生流水线

将 GitHub 仓库 `DDDouble-T/Coctail-WeChat` 的 `main` 分支绑定到微信云托管环境 `paw-inn-d9gixxkg3f894407e`、服务 `paw-inn`。由平台拉取代码、构建镜像、部署版本，无需在 GitHub Secrets 保存腾讯云密钥。

## 控制台配置

打开 [微信云托管控制台](https://cloud.weixin.qq.com/cloudrun)，进入目标环境与 `paw-inn` 服务，选择 **服务设置 → 流水线**。首次发布也可从 **部署发布 → 绑定 GitHub 仓库** 开始；保存后平台会生成同一份流水线配置。

| 配置项 | 本仓库的值 |
| --- | --- |
| 代码源 | GitHub，首次使用需完成 GitHub 授权 |
| 仓库 | `DDDouble-T/Coctail-WeChat` |
| 仓库 HTTPS 地址 | `https://github.com/DDDouble-T/Coctail-WeChat.git` |
| 分支 | `main` |
| 目标目录 / 构建上下文 | 留空，使用仓库根目录 |
| Dockerfile 文件 | `server/Dockerfile`，相对仓库根目录 |
| 端口 | `80` |
| 推送触发 | 开启；`main` 的 push / merge 自动构建并全量发布 |

后端实现位于 `server/`，但 Dockerfile 还需要根目录的 `package.json`、`package-lock.json`、`miniprogram/shared/` 和 `data/iba-cocktails/`。因此构建上下文使用根目录；将目标目录设为 `server` 会导致这些 `COPY` 输入不可见。对应本地构建命令是 `docker build -f server/Dockerfile .`。

先将本次修改完整推送到绑定分支，再从控制台执行一次流水线发布。微信云托管官方说明：完成 GitHub 授权并通过仓库成功发布一次后，平台会在仓库侧创建 webhook；后续 push / merge 根据流水线规则自动触发。不要删除该 webhook；重复 webhook 可能造成一次 push 多次发布。GitHub 普通仓库读取权限不等于能够安装此 webhook 的管理权限，授权账号需要具备相应仓库权限。

服务运行变量、TCB 身份、集合规则和探针见 [部署说明](deployment.md) 与 [CLI 操作](cloudbase-cli.md)。流水线部署不会自动初始化 TCB；种子数据通过已登录的 CLI 初始化脚本单独写入，避免把管理写权限和每次应用发布绑定。

推送触发按官方定义会直接全量发布现网。需要先做版本测试或灰度发布时，使用控制台手动发布流程；自动推送发布适用于已验证的分支。

## 当前可核验的授权阻塞

2026-10-30，通过已登录的 CloudBase CLI 只读调用 GitHub 仓库查询 API，返回：

```text
UnauthorizedOperation.CodeOAuthUnauthorized
请先对 github 平台授权
```

这表示 CloudBase 账号已登录，但尚未向微信云托管授权 GitHub 代码源。需要仓库所有者在上述控制台完成一次 GitHub OAuth 授权；不需要将 GitHub Token 或腾讯云密钥发到聊天中。完成授权后可再次只读查询：

```sh
npx -y --package @cloudbase/cli@3.8.10 tcb api tcb DescribeCloudBaseCodeRepos \
  --env-id paw-inn-d9gixxkg3f894407e \
  --body '{"Channel":"github","PageNumber":1,"PageSize":100}' --json

npx -y --package @cloudbase/cli@3.8.10 tcb api tcb DescribeCloudBaseCodeBranch \
  --env-id paw-inn-d9gixxkg3f894407e \
  --body '{"Channel":"github","PageNumber":1,"PageSize":100,"RepoName":"DDDouble-T/Coctail-WeChat"}' --json
```

API 名与参数来自已安装 CloudBase CLI 3.8.10 的仓库查询实现；分支查询的 `RepoName` 应以仓库列表返回的规范名称为准。公开 CLI 的 `cloudrun deploy --source` 用于发布本地代码，没有已核验的参数可同时创建 GitHub OAuth 授权与原生推送 webhook。因此原生绑定使用官方控制台，不用一次手工代码上传代替流水线绑定结果。

## 仓库验证工作流

`.github/workflows/backend.yml` 会在 PR、main 推送及手动触发时运行类型检查、43 项行为与数据测试、真实 Docker 构建和容器接口/图片检查。此工作流只验证，不保存云密钥，也不代替云托管原生发布。原生推送流水线与 GitHub Actions 各自触发；为确保发布前验证，建议通过 PR 合并已通过检查的修改，或关闭推送发布并在检查通过后手动发布。

## 验收

1. 控制台显示正确仓库、`main`、根构建上下文、`server/Dockerfile` 和端口 `80`。
2. 首次流水线构建成功，构建日志对应预期 Git commit，GitHub 仓库存在平台建立的 webhook。
3. 后端 `/healthz`、`/readyz` 成功，`/api/catalog` 返回 102 款 IBA 酒谱，处理图与原图通过后端地址可取。
4. 向绑定分支推送一次实际修改后，控制台自动产生新发布记录且 commit 一致，证明触发器生效。

官方依据：[微信云托管服务设置与流水线](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/guide/service/pipeline.html)、[微信云托管部署发布](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloudrun/src/guide/service/online.html)、[CloudBase 云托管概述与持续交付](https://docs.cloudbase.net/run/introduction)。
