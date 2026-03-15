# Claude Code Gitea Action

[![Tests](https://github.com/hooxing/claude_in_gitea/actions/workflows/ci.yml/badge.svg)](https://github.com/hooxing/claude_in_gitea/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> **English** | [中文](#chinese-readme)

Bring Claude Code AI assistance directly into your Gitea repositories.
Comment `@claude` on any PR or issue and let Claude analyse, review, fix and
commit code – all running on your own self-hosted Gitea + act_runner.

---

## ✨ Features

- **Interactive**: `@claude` in any PR/issue comment triggers Claude
- **Auto-review**: Set a `prompt` to review every PR automatically on open
- **Inline comments**: Claude can post targeted inline review comments
- **Code fixes & commits**: Claude creates branches and commits fixes directly
- **Fine-grained access control**: limit who can trigger by write-permission,
  user allow-list, label, or assignee
- **Self-hosted**: everything runs on your Gitea instance — no data leaves your
  network (except requests to the configured AI provider)

---

## 🚀 Quick Start

### 1. Import the action into your Gitea instance

```bash
# Mirror this repository to your Gitea instance
# e.g. gitea.example.com/your-org/claude_in_gitea
```

### 2. Add a workflow file

Create `.gitea/workflows/claude.yml` in the repository you want Claude to work on:

```yaml
name: Claude Code Action

on:
  issue_comment:
    types: [created]
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review:
    types: [submitted]
  pull_request_review_comment:
    types: [created]

jobs:
  claude:
    # Only run when @claude is mentioned (or prompt is set)
    if: |
      (github.event_name == 'issue_comment' && contains(github.event.comment.body, '@claude')) ||
      github.event_name == 'pull_request' ||
      github.event_name == 'pull_request_review' ||
      github.event_name == 'pull_request_review_comment'
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: 'http://gitea.example.com/your-org/actions-checkout@v4'

      - name: Setup Bun
        uses: 'http://gitea.example.com/your-org/setup-bun@v1'

      - name: Run Claude Code Gitea Action
        uses: 'http://gitea.example.com/your-org/claude_in_gitea@main'
        with:
          gitea_token: ${{ secrets.GITEATOKEN }}
          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

### 3. Configure secrets

In your Gitea repository → Settings → Secrets, add:

| Secret | Required | Description |
|--------|----------|-------------|
| `GITEATOKEN` | ✅ | Gitea personal access token with repo write access |
| `ANTHROPIC_API_KEY` | ✅ (or a cloud provider secret) | Anthropic API key |

### 4. Trigger

Comment `@claude <your request>` on any issue or PR. You should see a
"Claude Code is working…" comment appear within a few seconds.

---

## ⚙️ Configuration Reference

Key inputs (full list in [`action.yml`](action.yml)):

| Input | Default | Description |
|-------|---------|-------------|
| `gitea_token` | | Gitea token (required) |
| `anthropic_api_key` | | Anthropic API key |
| `trigger_phrase` | `@claude` | Phrase that triggers the action |
| `prompt` | | Fixed prompt for auto-review mode |
| `track_progress` | `false` | Enable progress-tracking comment |
| `use_sticky_comment` | `false` | Reuse the same status comment |
| `use_commit_signing` | `false` | GPG-sign commits via SSH key |
| `allowed_non_write_users` | | Comma-separated users allowed to trigger without write access |
| `allowed_bots` | | Comma-separated bot accounts allowed to trigger |

### Tuning pagination

For large PRs with many comments, increase the page limits via environment variables:

```yaml
env:
  GITEA_PAGINATION_LIMIT: "100"      # items per page (default: 50)
  GITEA_PAGINATION_MAX_PAGES: "20"   # max pages fetched (default: 10)
```

> **Note**: When the page limit is reached, a warning is logged. Results above
> the limit are silently truncated – increase these values if you see warnings.

---

## 🔐 Security

- Tokens are never logged or stored in comments
- Sensitive token patterns are redacted from all content sent to the AI
- Permission checks run before any action; non-write users require explicit
  allow-listing
- `allowed_non_write_users='*'` logs a security warning and should only be
  used in trusted environments

See [`docs/SECURITY.md`](docs/SECURITY.md) for the full security guide.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Setup, act_runner, mirroring external actions |
| [docs/USAGE.md](docs/USAGE.md) | Trigger modes, auto-review, tool permissions |
| [docs/SECURITY.md](docs/SECURITY.md) | Permission model, token handling |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common problems and solutions |
| [docs/TESTING.md](docs/TESTING.md) | Running the test suite |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, PR guidelines |

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  Gitea Actions Runner                               │
│                                                     │
│  src/entrypoints/run.ts  ← main entry point         │
│       │                                             │
│       ├── parseGiteaContext()  ← reads event JSON   │
│       ├── checkWritePermissions()                   │
│       ├── checkContainsTrigger()                    │
│       ├── prepareTagMode / prepareAgentMode         │
│       │        ├── fetchGiteaData()  ← Gitea REST   │
│       │        ├── setupBranch()                    │
│       │        └── createInitialComment()           │
│       └── runClaude()  ← Claude Code SDK            │
│                │                                    │
│                └── MCP servers (stdio):             │
│                     • gitea-comment-server          │
│                     • gitea-inline-comment-server   │
│                     • gitea-file-ops-server         │
└─────────────────────────────────────────────────────┘
```

---

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

---

<a id="chinese-readme"></a>

# Claude Code Gitea Action（中文）

Claude Code Gitea Action 是面向 Gitea Actions/act_runner 的 Claude Code 自动化方案，支持 PR/Issue 触发、自动审阅、评论更新与行内评论等能力。

## 关键注意事项
- PR 自动审阅需要 `prompt` + `track_progress: "true"` 或显式允许评论相关工具，否则可能出现执行成功但无评论输出
- Gitea Actions 默认从当前 Gitea 实例拉取 `uses:`，外部 Action 需镜像到本地并建议使用 tag 引用

## 文档索引
- 部署与镜像：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- 使用与触发：[docs/USAGE.md](docs/USAGE.md)
- 安全与权限：[docs/SECURITY.md](docs/SECURITY.md)
- 故障排查：[docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
- 测试说明：[docs/TESTING.md](docs/TESTING.md)

