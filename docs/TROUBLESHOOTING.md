# 故障排查

## 1. 未触发或提示 No trigger was met
可能原因：
- 评论中未包含 `@claude`
- `prompt` 为空且未开启自动审阅
- 触发者不在允许列表中

建议处理：
- 确认触发词与事件类型
- 检查 `allowed_non_write_users`、`include_comments_by_actor`
- 确认工作流已触发并加载到 runner

## 2. 工作流成功但无评论输出
可能原因：
- 未设置 `prompt` 或 `track_progress: "true"`
- 自定义 `allowedTools` 未包含评论工具

建议处理：
- 开启 `track_progress: "true"`
- 放行 `mcp__gitea_comment__update_claude_comment`

## 3. Action clone 失败
典型报错：`repository not found`

可能原因：
- 外部 Action 未镜像到本地
- 使用了 SHA 引用

建议处理：
- 将外部 Action 镜像到本地 Gitea
- 使用 tag 引用

## 4. 无法访问 Gitea API
可能原因：
- `GITEA_SERVER_URL` 或 `GITEA_API_URL` 不正确
- runner 与 Gitea 不在同一网络

建议处理：
- 在 runner 容器内测试 `curl http://gitea:3000/api/v1/version`
- 使用容器可达地址而非宿主机地址

## 5. 权限不足或 403
可能原因：
- `GITEATOKEN` 权限不足
- PR/Issue 禁止评论或仓库设置限制

建议处理：
- 更换具备写权限的 token
- 检查仓库权限与用户权限

## 6. Bun 或 Claude CLI 找不到
可能原因：
- runner 环境缺少 Bun 或 Claude Code CLI

建议处理：
- 使用 `path_to_bun_executable` 与 `path_to_claude_code_executable`
- 确认路径存在且可执行

## 7. API 超时或响应缓慢
可能原因：
- 网络不稳定或 Gitea 负载过高

建议处理：
- 调整 `GITEA_API_TIMEOUT_MS`
- 设置 `GITEA_API_RETRY_COUNT`

## 8. 只看到追踪评论，没有最终输出
可能原因：
- 模型请求失败或超时
- 评论工具未被允许

建议处理：
- 查看 runner 日志中的模型请求错误
- 放行评论工具或开启 `show_full_output` 临时排查
