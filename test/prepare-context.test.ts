#!/usr/bin/env bun

import { describe, test, expect } from "bun:test";
import { prepareContext } from "../src/create-prompt";
import {
  mockIssueCommentContext,
  mockPullRequestCommentContext,
  mockPullRequestReviewContext,
  mockPullRequestReviewCommentContext,
  mockIssueOpenedContext,
  mockPullRequestOpenedContext,
} from "./mockContext";

describe("prepareContext (Gitea)", () => {
  test("issue_comment (issue) 解析正确", () => {
    const result = prepareContext(
      mockIssueCommentContext,
      "12345",
      "main",
      "claude/issue-55",
    );

    expect(result.repository).toBe("test-owner/test-repo");
    expect(result.claudeCommentId).toBe("12345");
    expect(result.triggerUsername).toBe("contributor-user");
    expect(result.eventData.eventName).toBe("issue_comment");

    if (result.eventData.eventName === "issue_comment" && !result.eventData.isPR) {
      expect(result.eventData.issueNumber).toBe("55");
      expect(result.eventData.commentId).toBe("12345678");
      expect(result.eventData.baseBranch).toBe("main");
      expect(result.eventData.claudeBranch).toBe("claude/issue-55");
    }
  });

  test("issue_comment (PR) 解析正确", () => {
    const result = prepareContext(mockPullRequestCommentContext, "12345");

    expect(result.eventData.eventName).toBe("issue_comment");
    expect(result.eventData.isPR).toBe(true);

    if (result.eventData.eventName === "issue_comment" && result.eventData.isPR) {
      expect(result.eventData.prNumber).toBe("789");
      expect(result.eventData.commentId).toBe("87654321");
    }
  });

  test("pull_request_approved 解析正确", () => {
    const result = prepareContext(mockPullRequestReviewContext, "12345");

    expect(result.eventData.eventName).toBe("pull_request_approved");
    if (result.eventData.eventName === "pull_request_approved") {
      expect(result.eventData.prNumber).toBe("321");
    }
  });

  test("pull_request_comment 解析正确", () => {
    const result = prepareContext(mockPullRequestReviewCommentContext, "12345");

    expect(result.eventData.eventName).toBe("pull_request_comment");
    if (result.eventData.eventName === "pull_request_comment") {
      expect(result.eventData.prNumber).toBe("999");
      expect(result.eventData.commentId).toBeUndefined();
    }
  });

  test("issues opened 解析正确", () => {
    const result = prepareContext(
      mockIssueOpenedContext,
      "12345",
      "main",
      "claude/issue-42",
    );

    expect(result.eventData.eventName).toBe("issues");
    if (result.eventData.eventName === "issues" && result.eventData.eventAction === "opened") {
      expect(result.eventData.issueNumber).toBe("42");
      expect(result.eventData.baseBranch).toBe("main");
      expect(result.eventData.claudeBranch).toBe("claude/issue-42");
    }
  });

  test("pull_request opened 解析正确", () => {
    const result = prepareContext(mockPullRequestOpenedContext, "12345");

    expect(result.eventData.eventName).toBe("pull_request");
    if (result.eventData.eventName === "pull_request") {
      expect(result.eventData.prNumber).toBe("456");
    }
  });
});

