#!/usr/bin/env bun

import { describe, test, expect } from "bun:test";
import { checkContainsTrigger } from "../src/gitea/validation/trigger";
import { createMockContext } from "./mockContext";

const baseRepo = {
  name: "test-repo",
  full_name: "test-owner/test-repo",
  owner: { login: "test-owner" },
};

describe("checkContainsTrigger (Gitea)", () => {
  test("issue body 包含触发词", () => {
    const context = createMockContext({
      eventName: "issues",
      eventAction: "opened",
      isPR: false,
      payload: {
        action: "opened",
        issue: { number: 1, title: "", body: "hello @claude", pull_request: null },
        repository: baseRepo,
      } as any,
      inputs: { triggerPhrase: "@claude" } as any,
    });

    expect(checkContainsTrigger(context)).toBe(true);
  });

  test("issue label 触发", () => {
    const context = createMockContext({
      eventName: "issues",
      eventAction: "labeled",
      isPR: false,
      payload: {
        action: "labeled",
        issue: { number: 1, title: "", body: "", pull_request: null },
        label: { name: "claude" },
        repository: baseRepo,
      } as any,
      inputs: { labelTrigger: "claude" } as any,
    });

    expect(checkContainsTrigger(context)).toBe(true);
  });

  test("issue assigned 触发", () => {
    const context = createMockContext({
      eventName: "issues",
      eventAction: "assigned",
      isPR: false,
      payload: {
        action: "assigned",
        issue: { number: 1, title: "", body: "", assignee: { login: "claude" }, pull_request: null },
        repository: baseRepo,
      } as any,
      inputs: { assigneeTrigger: "@claude" } as any,
    });

    expect(checkContainsTrigger(context)).toBe(true);
  });

  test("issue_comment 包含触发词", () => {
    const context = createMockContext({
      eventName: "issue_comment",
      eventAction: "created",
      isPR: false,
      payload: {
        action: "created",
        comment: { id: 1, body: "@claude please help", user: { login: "user" } },
        issue: { number: 1, title: "", body: "", pull_request: null },
        repository: baseRepo,
      } as any,
      inputs: { triggerPhrase: "@claude" } as any,
    });

    expect(checkContainsTrigger(context)).toBe(true);
  });

  test("pull_request 评论包含触发词", () => {
    const context = createMockContext({
      eventName: "issue_comment",
      eventAction: "created",
      isPR: true,
      payload: {
        action: "created",
        comment: { id: 1, body: "@claude review this PR", user: { login: "user" } },
        issue: { number: 1, title: "", body: "", pull_request: {} },
        repository: baseRepo,
      } as any,
      inputs: { triggerPhrase: "@claude" } as any,
    });

    expect(checkContainsTrigger(context)).toBe(true);
  });

  test("prompt 提供时自动触发", () => {
    const context = createMockContext({
      eventName: "pull_request",
      eventAction: "opened",
      isPR: true,
      payload: {
        action: "opened",
        number: 1,
        pull_request: { number: 1, title: "", body: "", head: { ref: "x" }, base: { ref: "main" } },
        repository: baseRepo,
      } as any,
      inputs: { prompt: "请自动审阅这个 PR" } as any,
    });

    expect(checkContainsTrigger(context)).toBe(true);
  });

  test("pull_request body 触发", () => {
    const context = createMockContext({
      eventName: "pull_request",
      eventAction: "opened",
      isPR: true,
      payload: {
        action: "opened",
        number: 1,
        pull_request: { number: 1, title: "", body: "@claude", head: { ref: "x" }, base: { ref: "main" } },
        repository: baseRepo,
      } as any,
      inputs: { triggerPhrase: "@claude" } as any,
    });

    expect(checkContainsTrigger(context)).toBe(true);
  });

  test("pull_request_approved 触发", () => {
    const context = createMockContext({
      eventName: "pull_request_approved",
      eventAction: "reviewed",
      isPR: true,
      payload: {
        action: "reviewed",
        review: { content: "@claude review", type: "pull_request_review_approved" },
        pull_request: { number: 1, title: "", body: "", user: { login: "dev" } },
        repository: baseRepo,
      } as any,
      inputs: { triggerPhrase: "@claude" } as any,
    });

    expect(checkContainsTrigger(context)).toBe(true);
  });
});

