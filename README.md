# Claude Code Gitea Action

Claude Code Gitea Action 是面向 Gitea Actions/act_runner 的 Claude Code 自动化方案，支持 PR/Issue 触发、自动审阅、评论更新与行内评论等能力。

## 关键注意事项
- PR 自动审阅需要 `prompt` + `track_progress: "true"` 或显式允许评论相关工具，否则可能出现执行成功但无评论输出
- Gitea Actions 默认从当前 Gitea 实例拉取 `uses:`，外部 Action 需镜像到本地并建议使用 tag 引用

## 快速开始
1. 准备 Gitea 与 act_runner，并确保能访问 Gitea API
2. 配置必需 secrets 并引入工作流
3. 通过 @claude 或 PR 事件触发验证

## 文档索引
- 部署与镜像：docs/DEPLOYMENT.md
- 使用与触发：docs/USAGE.md
- 安全与权限：docs/SECURITY.md
- 故障排查：docs/TROUBLESHOOTING.md
- 测试说明：docs/TESTING.md
