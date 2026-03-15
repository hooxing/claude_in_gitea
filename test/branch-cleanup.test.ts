import { describe, test, expect } from "bun:test";
import { checkAndCommitOrDeleteBranch } from "../src/gitea/operations/branch-cleanup";
import { GITEA_SERVER_URL } from "../src/gitea/api/config";

type ClientConfig = {
  branchExists: boolean;
  compare?: { ahead_by?: number; total_commits?: number; files?: unknown[] };
  deleteFails?: boolean;
};

const createClient = (config: ClientConfig) => {
  return {
    get: async (path: string) => {
      if (path.includes("/branches/")) {
        if (!config.branchExists) {
          throw new Error("404");
        }
        return { name: "branch" };
      }
      if (path.includes("/compare/")) {
        if (!config.compare) {
          throw new Error("compare not configured");
        }
        return config.compare;
      }
      return {};
    },
    delete: async () => {
      if (config.deleteFails) {
        throw new Error("delete failed");
      }
      return {};
    },
  } as any;
};

describe("checkAndCommitOrDeleteBranch (Gitea)", () => {
  test("returns empty link when claudeBranch is undefined", async () => {
    const result = await checkAndCommitOrDeleteBranch(
      createClient({ branchExists: true }),
      "owner",
      "repo",
      undefined,
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(false);
    expect(result.branchLink).toBe("");
  });

  test("returns branch link when branch exists and has changes", async () => {
    const result = await checkAndCommitOrDeleteBranch(
      createClient({
        branchExists: true,
        compare: { ahead_by: 2, total_commits: 2, files: [{}] },
      }),
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

  test("deletes branch when compare shows no changes", async () => {
    const result = await checkAndCommitOrDeleteBranch(
      createClient({
        branchExists: true,
        compare: { ahead_by: 0, total_commits: 0, files: [] },
      }),
      "owner",
      "repo",
      "claude/issue-123",
      "main",
      false,
    );

    expect(result.shouldDeleteBranch).toBe(true);
    expect(result.branchLink).toBe("");
  });

  test("returns empty link when branch does not exist", async () => {
    const result = await checkAndCommitOrDeleteBranch(
      createClient({ branchExists: false }),
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