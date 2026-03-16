import { describe, test, expect, mock, beforeEach, afterEach } from "bun:test";
import { validateActionInputs } from "../src/gitea/validation/inputs";

describe("validateActionInputs", () => {
  const validInputs = {
    prompt: "",
    triggerPhrase: "@claude",
    assigneeTrigger: "",
    labelTrigger: "",
    baseBranch: undefined,
    branchPrefix: "claude/",
    branchNameTemplate: undefined,
    useStickyComment: false,
    useCommitSigning: false,
    sshSigningKey: "",
    botId: "12345",
    botName: "claude-bot",
    allowedBots: "",
    allowedNonWriteUsers: "",
    trackProgress: false,
    includeFixLinks: false,
    includeCommentsByActor: "",
    excludeCommentsByActor: "",
  };

  test("accepts valid inputs", () => {
    expect(() => validateActionInputs(validInputs)).not.toThrow();
  });

  test("returns parsed data matching input", () => {
    const result = validateActionInputs(validInputs);
    expect(result.triggerPhrase).toBe("@claude");
    expect(result.useStickyComment).toBe(false);
  });

  test("allows empty trigger_phrase", () => {
    expect(() =>
      validateActionInputs({ ...validInputs, triggerPhrase: "" }),
    ).not.toThrow();
  });

  test("rejects trigger_phrase exceeding 100 chars", () => {
    expect(() =>
      validateActionInputs({
        ...validInputs,
        triggerPhrase: "a".repeat(101),
      }),
    ).toThrow("trigger_phrase must be 100 characters or fewer");
  });

  test("rejects empty bot_name", () => {
    expect(() =>
      validateActionInputs({ ...validInputs, botName: "" }),
    ).toThrow("bot_name must not be empty");
  });

  test("rejects branch_prefix exceeding 50 chars", () => {
    expect(() =>
      validateActionInputs({
        ...validInputs,
        branchPrefix: "x".repeat(51),
      }),
    ).toThrow("branch_prefix must be 50 characters or fewer");
  });

  test("error message lists all failures at once", () => {
    let error: Error | undefined;
    try {
      validateActionInputs({
        ...validInputs,
        triggerPhrase: "a".repeat(101),
        botName: "",
      });
    } catch (e) {
      error = e as Error;
    }
    expect(error).toBeDefined();
    expect(error!.message).toContain("triggerPhrase");
    expect(error!.message).toContain("botName");
  });

  test("rejects missing required fields", () => {
    expect(() => validateActionInputs({})).toThrow("Invalid action inputs");
  });

  test("accepts optional baseBranch as undefined", () => {
    const result = validateActionInputs({ ...validInputs, baseBranch: undefined });
    expect(result.baseBranch).toBeUndefined();
  });

  test("accepts optional baseBranch as string", () => {
    const result = validateActionInputs({ ...validInputs, baseBranch: "main" });
    expect(result.baseBranch).toBe("main");
  });
});
