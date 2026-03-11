#!/usr/bin/env bun

import { describe, test, expect } from "bun:test";
import { checkHumanActor } from "../src/gitea/validation/actor";
import { createMockContext } from "./mockContext";

const createMockClient = (login: string, shouldThrow = false) => {
  return {
    get: async () => {
      if (shouldThrow) {
        throw new Error("network error");
      }
      return { login };
    },
  } as any;
};

describe("checkHumanActor (Gitea)", () => {
  test("allows human user", async () => {
    const client = createMockClient("human-user");
    const context = createMockContext();
    context.actor = "human-user";

    await expect(checkHumanActor(client, context)).resolves.toBeUndefined();
  });

  test("blocks disallowed bot", async () => {
    const client = createMockClient("test-bot");
    const context = createMockContext();
    context.actor = "test-bot";
    context.inputs.allowedBots = "";

    await expect(checkHumanActor(client, context)).rejects.toThrow(
      "Workflow initiated by non-human actor: test-bot. Add bot to allowed_bots list or use '*' to allow all bots.",
    );
  });

  test("allows all bots with wildcard", async () => {
    const client = createMockClient("test-bot");
    const context = createMockContext();
    context.actor = "test-bot";
    context.inputs.allowedBots = "*";

    await expect(checkHumanActor(client, context)).resolves.toBeUndefined();
  });

  test("allows allowlisted bot", async () => {
    const client = createMockClient("dependabot[bot]");
    const context = createMockContext();
    context.actor = "dependabot[bot]";
    context.inputs.allowedBots = "dependabot[bot],renovate[bot]";

    await expect(checkHumanActor(client, context)).resolves.toBeUndefined();
  });

  test("blocks suspected bot when lookup fails", async () => {
    const client = createMockClient("ignored", true);
    const context = createMockContext();
    context.actor = "other-bot";
    context.inputs.allowedBots = "";

    await expect(checkHumanActor(client, context)).rejects.toThrow(
      "Workflow initiated by suspected bot actor: other-bot. Add bot to allowed_bots list or use '*' to allow all bots.",
    );
  });
});
