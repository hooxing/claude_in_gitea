# 部署与镜像

## 1. 先决条件
- Gitea 支持 Actions/act_runner 与 pull_request 事件
- act_runner 能执行工作流并访问 Gitea API
- 网络可达外部模型服务或已配置内网网关
- 依赖包含 Bun 与 Claude Code CLI 或自定义路径

## 2. 获取代码
将该仓库导入或克隆到你的 Gitea 实例，确保 Actions 可以拉取到本仓库。

## 3. act_runner 配置
确认 runner 与 Gitea 同网段或具备访问权限，且容器内能访问 Gitea API。

## 4. 外部 Action 镜像
Gitea Actions 默认从当前 Gitea 实例拉取 `uses:` 的 Action。

建议做法：
- 将外部 Action 镜像到本地 Gitea
- 使用 tag 引用，例如 `@v2.1.2`
- 避免使用 SHA 引用，Gitea 会将其当作分支

常见错误：
- `repository not found` 通常是未镜像或引用了 SHA

## 5. Secrets 与权限
建议准备以下 secrets：
- `GITEATOKEN`
- `ANTHROPIC_API_KEY` 或模型网关参数

权限建议：
- token 仅授予仓库写权限
- 若需非写权限用户触发，使用 `allowed_non_write_users`
