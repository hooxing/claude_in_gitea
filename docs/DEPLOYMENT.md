# 部署与镜像

## 1. 先决条件
- Gitea 需启用 Actions/act_runner，并支持 `pull_request` 事件
- act_runner 能执行工作流，并可访问 Gitea API
- 运行环境可访问模型服务或已配置内网网关
- 依赖包含 Bun 与 Claude Code CLI，或在工作流中提供自定义路径

## 2. 最小部署步骤
1. 将本仓库导入到你的 Gitea 实例
2. 在目标业务仓库中启用 Actions
3. 配置 `GITEATOKEN` 与模型密钥等 secrets
4. 添加工作流文件并触发一次 PR 或 @claude 评论
5. 看到“Claude Code is working...”即可判定链路可用

## 3. act_runner 与网络
- runner 在容器内运行时，`GITEA_SERVER_URL` 应使用容器可访问的地址
- 若 Gitea 在同一 docker 网络内，可使用服务名，例如 `http://gitea:3000`
- 若 runner 运行在宿主机，通常使用 `http://localhost:3000` 或可路由的内网地址

建议检查：
- runner 容器内能否 `curl http://gitea:3000/api/v1/version`
- Gitea API 返回非 200 时，优先排查网络与反代

## 4. 外部 Action 镜像
Gitea Actions 默认从当前 Gitea 实例拉取 `uses:` 的 Action。引用外部 GitHub Action 时需镜像到本地。

推荐流程：
1. 在 Gitea 创建镜像仓库，例如 `oven-sh/setup-bun`
2. 将上游 Action 内容同步到该仓库
3. 用 tag 引用本地 Action

示例：
```yaml
- uses: 'http://gitea:3000/oven-sh/setup-bun@v1.2.0'
```

注意事项：
- 避免使用 SHA，Gitea 会将其当作分支，导致 `repository not found`
- 如需定期同步，可手动更新或通过镜像任务保持一致

## 5. Secrets 与权限
建议准备：
- `GITEATOKEN`
- `ANTHROPIC_API_KEY` 或模型网关参数

权限建议：
- Token 仅授予仓库写权限
- 仅在需要时开放评论与提交能力
- 非写权限用户触发需配置 `allowed_non_write_users`

## 6. 可选环境变量
以下变量用于运行时优化或故障排查：
- `GITEA_API_URL` 自定义 API 地址，默认由 `GITEA_SERVER_URL` 推导
- `GITEA_API_TIMEOUT_MS` API 超时
- `GITEA_API_RETRY_COUNT` API 重试次数
- `GITEA_PAGINATION_LIMIT` 每页数量
- `GITEA_PAGINATION_MAX_PAGES` 最多拉取页数

## 7. 常见部署检查清单
- Actions 是否启用
- runner 是否在线并有执行权限
- `GITEATOKEN` 是否可写入评论
- 模型服务是否可达
- 外部 Action 是否已镜像并用 tag 引用
