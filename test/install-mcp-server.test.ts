import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { prepareMcpConfig } from "../src/mcp/install-mcp-server";
import { createMockContext } from "./mockContext";

const ORIGINAL_ENV = { ...process.env };

function restoreEnv() {
  process.env = { ...ORIGINAL_ENV };
}

describe("prepareMcpConfig (Gitea)", () => {
  beforeEach(() => {
    process.env.GITEA_ACTION_PATH = "/test/action/path";
    process.env.GITEA_WORKSPACE = "/workspace";
  });

  afterEach(() => {
    restoreEnv();
  });

  test("默认包含 gitea_comment server", async () => {
    const context = createMockContext();
    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_comment).toBeDefined();
    expect(parsed.mcpServers.gitea_comment.env.GITEA_TOKEN).toBe("test-token");
  });

  test("开启 commit signing 时包含 gitea_file_ops", async () => {
    const context = createMockContext({
      inputs: { useCommitSigning: true } as any,
    });

    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: [],
      mode: "tag",
      context,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_file_ops).toBeDefined();
    expect(parsed.mcpServers.gitea_file_ops.env.BRANCH_NAME).toBe("test-branch");
  });

  test("PR 且允许 inline 工具时包含 gitea_inline_comment", async () => {
    const context = createMockContext({ eventName: "pull_request", isPR: true, entityNumber: 456 });

    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: ["mcp__gitea_inline_comment__create_inline_comment"],
      mode: "tag",
      context,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_inline_comment).toBeDefined();
    expect(parsed.mcpServers.gitea_inline_comment.env.PR_NUMBER).toBe("456");
  });

  test("启用 CI MCP 时包含 gitea_ci", async () => {
    process.env.ENABLE_GITEA_CI_MCP = "true";
    const context = createMockContext({ eventName: "pull_request", isPR: true, entityNumber: 456 });

    const result = await prepareMcpConfig({
      giteaToken: "test-token",
      owner: "test-owner",
      repo: "test-repo",
      branch: "test-branch",
      baseBranch: "main",
      allowedTools: ["mcp__gitea_ci__get_ci_status"],
      mode: "tag",
      context,
    });

    const parsed = JSON.parse(result);
    expect(parsed.mcpServers.gitea_ci).toBeDefined();
    expect(parsed.mcpServers.gitea_ci.env.GITEA_TOKEN).toBe("test-token");
  });
});
