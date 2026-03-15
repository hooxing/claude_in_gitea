# 测试

## 1. 单元测试
```bash
bun test
```

## 2. E2E 测试
```bash
GITEA_E2E=1 GITEA_BASE_URL=http://localhost:3000 GITEA_TOKEN=xxx GITEA_REPO=owner/repo bun test test/e2e/pr-auto-review.e2e.test.ts
```

说明：
- E2E 会创建分支与 PR，运行时间可能较长
- 建议在测试环境仓库中执行
