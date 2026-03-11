import { describe, test, expect } from "bun:test";
import {
  extractTriggerTimestamp,
  extractOriginalTitle,
  extractOriginalBody,
  filterCommentsToTriggerTime,
  filterReviewsToTriggerTime,
  isBodySafeToUse,
  fetchGiteaData,
} from "../src/gitea/data/fetcher";
import {
  mockIssueCommentContext,
  mockPullRequestReviewContext,
  mockPullRequestReviewCommentContext,
  mockPullRequestOpenedContext,
  mockIssueOpenedContext,
} from "./mockContext";

const createClient = (responses: Record<string, any>) => {
  return {
    get: async (path: string) => {
      if (path in responses) {
        return responses[path];
      }
      throw new Error(`Unexpected path: ${path}`);
    },
  } as any;
};

describe("extractTriggerTimestamp", () => {
  test("issue_comment", () => {
    expect(extractTriggerTimestamp(mockIssueCommentContext)).toBe(
      "2024-01-15T12:30:00Z",
    );
  });

  test("pull_request_approved returns undefined", () => {
    expect(extractTriggerTimestamp(mockPullRequestReviewContext)).toBeUndefined();
  });

  test("pull_request_comment returns undefined", () => {
    expect(extractTriggerTimestamp(mockPullRequestReviewCommentContext)).toBeUndefined();
  });

  test("pull_request event returns undefined", () => {
    expect(extractTriggerTimestamp(mockPullRequestOpenedContext)).toBeUndefined();
  });

  test("issues event returns undefined", () => {
    expect(extractTriggerTimestamp(mockIssueOpenedContext)).toBeUndefined();
  });
});

describe("extractOriginalTitle / Body", () => {
  test("extract title", () => {
    expect(extractOriginalTitle(mockIssueOpenedContext)).toBe(
      "Bug: Application crashes on startup",
    );
  });

  test("extract body", () => {
    expect(extractOriginalBody(mockPullRequestOpenedContext)).toContain(
      "JWT-based authentication",
    );
  });
});

describe("filterCommentsToTriggerTime", () => {
  test("filters comments after trigger time", () => {
    const comments = [
      { id: 1, created_at: "2024-01-15T11:00:00Z" },
      { id: 2, created_at: "2024-01-15T12:00:00Z" },
      { id: 3, created_at: "2024-01-15T12:00:01Z" },
    ];

    const result = filterCommentsToTriggerTime(comments as any, "2024-01-15T12:00:00Z");
    expect(result.map((c) => c.id)).toEqual([1]);
  });
});

describe("filterReviewsToTriggerTime", () => {
  test("filters reviews after trigger time", () => {
    const reviews = [
      { id: 1, submitted_at: "2024-01-15T11:00:00Z" },
      { id: 2, submitted_at: "2024-01-15T12:00:00Z" },
      { id: 3, submitted_at: "2024-01-15T12:00:01Z" },
    ];

    const result = filterReviewsToTriggerTime(reviews as any, "2024-01-15T12:00:00Z");
    expect(result.map((r) => r.id)).toEqual([1]);
  });
});

describe("isBodySafeToUse", () => {
  test("returns false when edited after trigger", () => {
    const data = { created_at: "2024-01-15T10:00:00Z", updated_at: "2024-01-15T13:00:00Z" };
    expect(isBodySafeToUse(data as any, "2024-01-15T12:00:00Z")).toBe(false);
  });

  test("returns true when edited before trigger", () => {
    const data = { created_at: "2024-01-15T10:00:00Z", updated_at: "2024-01-15T11:00:00Z" };
    expect(isBodySafeToUse(data as any, "2024-01-15T12:00:00Z")).toBe(true);
  });
});

describe("fetchGiteaData", () => {
  test("fetch issue data with comments", async () => {
    const responses = {
      "/repos/owner/repo/issues/1": {
        number: 1,
        title: "Issue title",
        body: "Issue body",
        user: { login: "alice" },
      },
      "/repos/owner/repo/issues/1/comments": [
        { id: 11, body: "comment", user: { login: "bob" }, created_at: "2024-01-01T00:00:00Z" },
      ],
      "/users/alice": { full_name: "Alice" },
    };

    const result = await fetchGiteaData({
      client: createClient(responses),
      repository: "owner/repo",
      prNumber: "1",
      isPR: false,
      triggerUsername: "alice",
    });

    expect(result.contextData.title).toBe("Issue title");
    expect(result.comments).toHaveLength(1);
    expect(result.triggerDisplayName).toBe("Alice");
  });

  test("fetch PR data with reviews", async () => {
    const responses = {
      "/repos/owner/repo/pulls/2": {
        number: 2,
        title: "PR title",
        body: "PR body",
        user: { login: "alice" },
        head: { ref: "feature", sha: "abc", repo: { full_name: "owner/repo" } },
        base: { ref: "main", sha: "def", repo: { full_name: "owner/repo" } },
        state: "open",
        merged: false,
      },
      "/repos/owner/repo/pulls/2/files": [
        { filename: "src/a.ts", additions: 1, deletions: 0, status: "modified" },
      ],
      "/repos/owner/repo/issues/2/comments": [
        { id: 21, body: "comment", user: { login: "bob" }, created_at: "2024-01-01T00:00:00Z" },
      ],
      "/repos/owner/repo/pulls/2/reviews": [
        { id: 10, body: "review", user: { login: "carol" }, submitted_at: "2024-01-01T01:00:00Z" },
      ],
      "/repos/owner/repo/pulls/2/reviews/10/comments": [
        { id: 99, body: "inline", user: { login: "dave" }, path: "src/a.ts", position: 3, created_at: "2024-01-01T01:10:00Z" },
      ],
      "/users/alice": { full_name: "Alice" },
    };

    const result = await fetchGiteaData({
      client: createClient(responses),
      repository: "owner/repo",
      prNumber: "2",
      isPR: true,
      triggerUsername: "alice",
    });

    expect(result.contextData.title).toBe("PR title");
    expect(result.changedFiles).toHaveLength(1);
    expect(result.reviewData?.nodes?.length).toBe(1);
  });
});
