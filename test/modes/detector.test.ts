import { describe, test, expect } from "bun:test";
import { detectMode } from "../../src/modes/detector";
import { createMockContext } from "../mockContext";

describe("detectMode (Gitea)", () => {
  test("track_progress Ç¿ÖÆ tag", () => {
    const context = createMockContext({
      eventName: "issues",
      eventAction: "opened",
      inputs: { trackProgress: true } as any,
      payload: {
        action: "opened",
        issue: { number: 1, body: "@claude", pull_request: null },
        repository: { name: "test-repo", owner: { login: "test-owner" } },
      } as any,
    });

    expect(detectMode(context)).toBe("tag");
  });

  test("issue_comment + prompt -> agent", () => {
    const context = createMockContext({
      eventName: "issue_comment",
      eventAction: "created",
      inputs: { prompt: "do it" } as any,
      payload: {
        action: "created",
        comment: { id: 1, body: "hi", user: { login: "user" } },
        issue: { number: 1, pull_request: null },
        repository: { name: "test-repo", owner: { login: "test-owner" } },
      } as any,
    });

    expect(detectMode(context)).toBe("agent");
  });

  test("issue_comment + trigger -> tag", () => {
    const context = createMockContext({
      eventName: "issue_comment",
      eventAction: "created",
      inputs: { triggerPhrase: "@claude" } as any,
      payload: {
        action: "created",
        comment: { id: 1, body: "@claude please", user: { login: "user" } },
        issue: { number: 1, pull_request: null },
        repository: { name: "test-repo", owner: { login: "test-owner" } },
      } as any,
    });

    expect(detectMode(context)).toBe("tag");
  });

  test("pull_request opened + prompt -> agent", () => {
    const context = createMockContext({
      eventName: "pull_request",
      eventAction: "opened",
      inputs: { prompt: "review" } as any,
      payload: {
        action: "opened",
        number: 1,
        pull_request: { number: 1, body: "" },
        repository: { name: "test-repo", owner: { login: "test-owner" } },
      } as any,
      isPR: true,
    });

    expect(detectMode(context)).toBe("agent");
  });

  test("Ä¬ÈÏ agent", () => {
    const context = createMockContext({
      eventName: "workflow_dispatch",
      payload: {} as any,
    } as any);

    expect(detectMode(context)).toBe("agent");
  });
});
