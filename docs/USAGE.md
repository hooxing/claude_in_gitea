# 使用与触发

## 1. 触发方式
- Issue 或 PR 评论中包含 `@claude`
- PR 自动审阅需要设置 `prompt` 与 `track_progress: "true"`
- 如需定制评论工具权限，可显式配置 `allowedTools`

## 2. 工作流示例
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

## 3. 运行模式
- tag 模式：依赖评论触发，输出追踪评论
- agent 模式：自动执行 prompt，适用于自动审阅
- 自动检测：根据事件与输入决定

## 4. 自动修复与提交
- 通过 @claude 指令请求修复
- 需要写权限以提交变更
- `use_commit_signing` 会影响提交方式

## 5. MCP 工具
常见工具示例：
- `mcp__gitea_comment__update_claude_comment`
- `mcp__gitea_inline_comment__create_inline_comment`
- `mcp__gitea_file_ops__commit_files`
