import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { updateCommentBody } from "../src/gitea/operations/comment-logic";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe("updateCommentBody (Gitea)", () => {
  beforeEach(() => {
    process.env.GITEA_SERVER_URL = "https://gitea.example.com";
  });

  afterEach(() => {
    restoreEnv();
  });

  test("成功完成时包含任务与分支链接", () => {
    const result = updateCommentBody({
      currentBody: "Claude Code is working...",
      actionFailed: false,
      executionDetails: { duration_ms: 62000 },
      jobUrl: "https://gitea.example.com/owner/repo/actions/runs/123",
      branchLink: "\n[View branch](https://gitea.example.com/owner/repo/src/branch/claude/issue-1)",
      branchName: "claude/issue-1",
      triggerUsername: "alice",
    });

    expect(result).toContain("Claude finished @alice's task in 1m 2s");
    expect(result).toContain("[View job](https://gitea.example.com/owner/repo/actions/runs/123)");
    expect(result).toContain("[`claude/issue-1`](https://gitea.example.com/owner/repo/src/branch/claude/issue-1)");
  });

  test("失败时输出错误详情", () => {
    const result = updateCommentBody({
      currentBody: "Claude Code is working...",
      actionFailed: true,
      executionDetails: { duration_ms: 5000 },
      jobUrl: "https://gitea.example.com/owner/repo/actions/runs/999",
      errorDetails: "boom",
    });

    expect(result).toContain("Claude encountered an error after 5s");
    expect(result).toContain("```\nboom\n```");
  });

  test("优先使用正文里的 Create PR 链接", () => {
    const result = updateCommentBody({
      currentBody: "Some comment\n[Create a PR](https://gitea.example.com/owner/repo/compare/main...feature)",
      actionFailed: false,
      executionDetails: null,
      jobUrl: "https://gitea.example.com/owner/repo/actions/runs/321",
      prLink: "\n[Create a PR](https://gitea.example.com/owner/repo/compare/main...other)",
      triggerUsername: "bob",
    });

    expect(result).toContain("[Create PR](https://gitea.example.com/owner/repo/compare/main...feature)");
  });
});
