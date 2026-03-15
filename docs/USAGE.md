# 使用与触发

## 1. 触发方式概览
- Issue 或 PR 评论中包含 `@claude`
- PR 自动审阅通过 `prompt` 与 `track_progress: "true"` 触发
- 可通过 `label_trigger` 或 `assignee_trigger` 进行辅助触发

常见触发事件建议：
```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
  issue_comment:
    types: [created]
```

## 2. 自动审阅配置
自动审阅必须满足两个条件：
- 有明确的 `prompt`
- 开启 `track_progress: "true"` 或显式允许评论工具

示例：
```yaml
- name: Run Claude Code Gitea Action
  uses: 'http://gitea:3000/owner/claude-code-action-gitea@main'
  with:
    gitea_token: ${{ secrets.GITEATOKEN }}
    anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
    prompt: |
      请自动审阅 PR，重点关注边界条件与潜在 bug。
    track_progress: 'true'
```

## 3. 评论触发流程
- 在 PR 或 Issue 评论中输入 `@claude`
- 触发后应生成追踪评论 “Claude Code is working...”
- 若无输出，优先检查触发词、权限与工具白名单

## 4. 运行模式说明
- tag 模式依赖评论触发，适合互动式场景
- agent 模式自动执行 `prompt`，适合自动审阅
- 自动检测会根据事件类型与输入自动选择

## 5. 触发过滤与权限控制
可用的输入项包括：
- `allowed_non_write_users` 允许无写权限用户触发
- `allowed_bots` 允许机器人账号触发
- `include_comments_by_actor` 仅允许指定用户
- `exclude_comments_by_actor` 排除指定用户
- `label_trigger` 标签触发
- `assignee_trigger` 指派触发

建议策略：
- 生产环境默认限制触发用户
- 对外部贡献者的 PR 采用只读审阅

## 6. 自动修复与提交
- 通过 @claude 指令请求修复
- 需要写权限以提交变更
- `use_commit_signing` 会影响提交方式
- 若没有实际改动，分支会被清理

## 7. 工具权限与 allowedTools
- 评论输出需要允许评论相关工具
- 行内评论需要允许行内评论工具
- 自动提交需要允许提交工具

常用工具示例：
- `mcp__gitea_comment__update_claude_comment`
- `mcp__gitea_inline_comment__create_inline_comment`
- `mcp__gitea_file_ops__commit_files`

若开启自定义工具白名单，请确保包含以上能力。

## 8. 典型 PR 流程示例
1. 开发者创建 PR
2. 自动审阅在 PR 上生成评论
3. 开发者回复 `@claude` 请求修复
4. Action 创建或更新分支并提交修复
5. 审阅结果与提交记录在 PR 中可追踪

## 9. 常见使用场景
- 仅自动审阅，不允许修改代码
- 评论触发并允许修复
- 仅在指定标签或指定人员触发
- 在分支规则满足时自动执行
