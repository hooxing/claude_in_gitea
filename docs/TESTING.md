# 测试

## 1. 单元测试
```bash
bun test
```

常用局部测试示例：
```bash
bun test test/trigger-validation.test.ts
bun test test/branch-cleanup.test.ts
```

## 2. E2E 测试
E2E 会创建分支与 PR，并在 PR 上等待审阅评论。

必需环境变量：
- `GITEA_E2E=1`
- `GITEA_BASE_URL=http://localhost:3000`
- `GITEA_TOKEN=你的token`
- `GITEA_REPO=owner/repo`

可选环境变量：
- `GITEA_DEFAULT_BRANCH=main`
- `GITEA_E2E_TIMEOUT_MS=120000`

执行示例：
```bash
GITEA_E2E=1 GITEA_BASE_URL=http://localhost:3000 GITEA_TOKEN=xxx GITEA_REPO=owner/repo bun test test/e2e/pr-auto-review.e2e.test.ts
```

## 3. 清理与回滚
- E2E 会创建 PR 与分支，建议在专用测试仓库中运行
- 若中断执行，可手动删除残留分支与 PR

## 4. 常见测试问题
- 运行时间较长：提高 `GITEA_E2E_TIMEOUT_MS`
- 无评论输出：确认工作流是否启用自动审阅
- 本地/CI 访问 Gitea 失败：检查网络与 URL
