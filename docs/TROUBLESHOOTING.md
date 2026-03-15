# 故障排查

## 1. 未触发
- 检查事件类型与工作流是否生效
- 评论触发需包含 `@claude`
- 自动审阅需配置 `prompt` 与 `track_progress: "true"`

## 2. 无评论输出
- 确认有权限创建评论
- 检查是否限制了 `allowedTools`

## 3. Action clone 失败
- 确认外部 Action 已镜像到本地 Gitea
- 避免使用 SHA 引用，建议使用 tag

## 4. API 连接或权限错误
- 确认 `GITEATOKEN` 有效
- 确认 runner 可访问 Gitea API
