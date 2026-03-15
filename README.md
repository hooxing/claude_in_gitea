# Claude Code Gitea Action

这是一个面向 **Gitea Actions / act_runner** 的 Claude Code 自动化实现，基于原 GitHub 版本重构。

## 主要特性
- 支持 `tag` 与 `agent` 模式（自动检测）
- 支持 Issue/PR 评论触发
- 支持使用 MCP 工具更新评论、提交文件
- 支持 PR 行内评论（line+side 或 position 自动映射）
- 支持 PR 自动审阅（通过 `prompt` 触发）

## 关键环境变量
- `GITEA_API_URL`：Gitea API Base，默认 `https://gitea.com/api/v1`
- `GITEA_SERVER_URL`：Gitea Web URL，默认 `https://gitea.com`
- `GITEA_TOKEN`：访问令牌（或通过 action 输入传入 `gitea_token`）
- 兼容 `GITHUB_*` 环境变量回退（用于 Gitea Actions 未覆盖的场景）

## 自动审阅（无需 @claude）
在 PR 打开/更新时自动审阅，请在 workflow 里传入 `prompt`，并启用 `track_progress`：
- `prompt`：审阅规则/要求
- `track_progress: "true"`：强制使用 tag 模式并生成追踪评论

## Gitea Actions 依赖镜像
Gitea Actions 默认会从当前 Gitea 实例拉取 `uses:` 的 Action。若使用外部 Action（如 `oven-sh/setup-bun`）：
- 推荐镜像到本地 Gitea，并使用 tag 引用（例如 `@v2.1.2`）
- 避免使用 SHA 引用（部分 Gitea/runner 环境会把 SHA 当成分支拉取导致失败）

## 注意事项
- Gitea inline review comment 使用 `position`（diff position）
- Gitea REST API 不支持 GitHub 的原子 multi-file commit，`mcp__gitea_file_ops__commit_files` 采用逐文件提交
- CI MCP Server 默认禁用（需自行实现并设置 `ENABLE_GITEA_CI_MCP=true`）
- 行内评论工具会按需拉取 PR diff 计算位置，建议只对稳定的文件路径/行号使用

## 可选环境变量
- `GITEA_PAGINATION_LIMIT`：分页每页数量，默认 50
- `GITEA_PAGINATION_MAX_PAGES`：分页最大页数，默认 10
- `GITEA_API_TIMEOUT_MS`：API 请求超时（毫秒），默认 15000
- `GITEA_API_RETRY_COUNT`：API GET 请求重试次数，默认 2
- `GITEA_API_RETRY_DELAY_MS`：API GET 重试基础延迟（毫秒），默认 500

## MCP 工具说明
- `mcp__gitea_comment__update_claude_comment`：更新 Claude 追踪评论
- `mcp__gitea_inline_comment__create_inline_comment`：行内评论（支持 `line`+`side` 或 `position`）
- `mcp__gitea_file_ops__commit_files`：通过 contents API 提交文件

## 运行入口
- `src/entrypoints/run.ts`

## 开发命令
- `bun run typecheck`
- `bun run format`

