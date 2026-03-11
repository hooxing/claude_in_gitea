import { describe, test, expect } from "bun:test";
import { checkAndCommitOrDeleteBranch } from "../src/gitea/operations/branch-cleanup";
import { GITEA_SERVER_URL } from "../src/gitea/api/config";

const createClient = (branchExists: boolean) => {
  return {
    get: async () => {
      if (!branchExists) {
        throw new Error("404");
      }
      return { name: "branch" };
    },
  } as any;
};

describe("checkAndCommitOrDeleteBranch (Gitea)", () => {
  test("claudeBranch 为空时返回空链接", async () => {
    const result = await checkAndCommitOrDeleteBranch(
      createClient(true),
      "owner",
      "repo",
      undefined,
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe("");
  });

  test("分支存在时返回 branch 链接", async () => {
    const result = await checkAndCommitOrDeleteBranch(
      createClient(true),
      "owner",
      "repo",
      "claude/issue-123",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe(
      `\n[View branch](${GITEA_SERVER_URL}/owner/repo/src/branch/claude/issue-123)`,
    );
  });

  test("分支不存在时返回空链接", async () => {
    const result = await checkAndCommitOrDeleteBranch(
      createClient(false),
      "owner",
      "repo",
      "claude/issue-123",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe("");
  });
});
