import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import type { PreparedContext } from "../src/create-prompt";
import type { FetchDataResult } from "../src/gitea/data/fetcher";

const ORIGINAL_ENV = { ...process.env };

let generatePrompt: typeof import("../src/create-prompt").generatePrompt;
let buildAllowedToolsString: typeof import("../src/create-prompt").buildAllowedToolsString;
let buildDisallowedToolsString: typeof import("../src/create-prompt").buildDisallowedToolsString;

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe("create-prompt (Gitea)", () => {
  beforeAll(async () => {
    process.env.GITEA_RUN_ID = "123";

    const mod = await import("../src/create-prompt");
    generatePrompt = mod.generatePrompt;
    buildAllowedToolsString = mod.buildAllowedToolsString;
    buildDisallowedToolsString = mod.buildDisallowedToolsString;
  });

  afterAll(() => {
    restoreEnv();
  });

  const baseContext: PreparedContext = {
    repository: "owner/repo",
    claudeCommentId: "999",
    triggerPhrase: "@claude",
    triggerUsername: "alice",
    eventData: {
      eventName: "pull_request",
      eventAction: "opened",
      isPR: true,
      prNumber: "12",
      baseBranch: "main",
      claudeBranch: "claude/pr-12",
    },
  };

  const giteaData: FetchDataResult = {
    contextData: {
      number: 12,
      title: "Test PR",
      body: "PR body",
      user: { login: "alice" },
      head: { ref: "feature", sha: "abc", repo: { full_name: "owner/repo" } },
      base: { ref: "main", sha: "def", repo: { full_name: "owner/repo" } },
      state: "open",
      merged: false,
    } as any,
    comments: [],
    changedFiles: [],
    changedFilesWithSHA: [],
    reviewData: { nodes: [] },
    imageUrlMap: new Map(),
    triggerDisplayName: "Alice",
  };

  test("prompt includes core context", () => {
    const prompt = generatePrompt(baseContext, giteaData, false, "tag");
    expect(prompt).toContain("Gitea Actions");
    expect(prompt).toContain("repository: owner/repo");
    expect(prompt).toContain("pr_number: 12");
    expect(prompt).toContain("actions/runs/123");
  });

  test("includes create PR link", () => {
    const prompt = generatePrompt(baseContext, giteaData, false, "tag");
    expect(prompt).toContain(
      "[Create a PR](https://gitea.com/owner/repo/compare/main...claude/pr-12)",
    );
  });

  test("agent mode returns prompt directly", () => {
    const ctx: PreparedContext = {
      ...baseContext,
      prompt: "Do something",
    };
    const prompt = generatePrompt(ctx, giteaData, false, "agent");
    expect(prompt).toBe("Do something");
  });

  test("allowed tools include Gitea tools", () => {
    const tools = buildAllowedToolsString([], false, false);
    expect(tools).toContain("mcp__gitea_comment__update_claude_comment");
    expect(tools).toContain("Bash(git add:*)");
  });

  test("commit signing uses file ops tools", () => {
    const tools = buildAllowedToolsString([], false, true);
    expect(tools).toContain("mcp__gitea_file_ops__commit_files");
    expect(tools).toContain("mcp__gitea_file_ops__delete_files");
  });

  test("disallowed tools default to WebSearch/WebFetch", () => {
    const disallowed = buildDisallowedToolsString([], []);
    expect(disallowed).toContain("WebSearch");
    expect(disallowed).toContain("WebFetch");
  });

  test("disallowed tools exclude already allowed tools", () => {
    const disallowed = buildDisallowedToolsString([], ["WebSearch"]);
    expect(disallowed).not.toContain("WebSearch");
  });
});
