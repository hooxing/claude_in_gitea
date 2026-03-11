import { describe, test, expect, beforeEach, afterEach, spyOn } from "bun:test";
import { prepareAgentMode } from "../../src/modes/agent";
import { createMockAutomationContext } from "../mockContext";
import * as gitConfig from "../../src/gitea/operations/git-config";

const createClient = (login: string) => {
  return {
    get: async () => ({ login }),
  } as any;
};

describe("Agent Mode (Gitea)", () => {
  let configureGitAuthSpy: any;

  beforeEach(() => {
    configureGitAuthSpy = spyOn(gitConfig, "configureGitAuth").mockImplementation(async () => {});
  });

  afterEach(() => {
    configureGitAuthSpy?.mockRestore();
  });

  test("prepareAgentMode returns claudeArgs", async () => {
    const context = createMockAutomationContext();
    process.env.CLAUDE_ARGS = "--model claude-sonnet-4 --max-turns 10";

    const result = await prepareAgentMode({
      context,
      client: createClient("human-user"),
      giteaToken: "test-token",
    });

    expect(result.claudeArgs).toContain("--model claude-sonnet-4");
    delete process.env.CLAUDE_ARGS;
  });

  test("blocks disallowed bot", async () => {
    const context = createMockAutomationContext();
    context.actor = "test-bot";
    context.inputs.allowedBots = "";

    await expect(
      prepareAgentMode({
        context,
        client: createClient("test-bot"),
        giteaToken: "test-token",
      }),
    ).rejects.toThrow(
      "Workflow initiated by non-human actor: test-bot. Add bot to allowed_bots list or use '*' to allow all bots.",
    );
  });

  test("allows allowlisted bot", async () => {
    const context = createMockAutomationContext();
    context.actor = "dependabot[bot]";
    context.inputs.allowedBots = "dependabot[bot]";

    await expect(
      prepareAgentMode({
        context,
        client: createClient("dependabot[bot]"),
        giteaToken: "test-token",
      }),
    ).resolves.toBeDefined();
  });
});
