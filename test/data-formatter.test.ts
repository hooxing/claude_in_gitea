import { describe, test, expect } from "bun:test";
import {
  formatContext,
  formatBody,
  formatComments,
  formatReviewComments,
  formatChangedFilesWithSHA,
} from "../src/gitea/data/formatter";

const imageMap = new Map<string, string>([
  ["https://example.com/img.png", "/tmp/gitea-images/img.png"],
]);

describe("formatContext (Gitea)", () => {
  test("PR context", () => {
    const result = formatContext(
      {
        title: "Add feature",
        user: { login: "alice" },
        head: { ref: "feature" },
        base: { ref: "main" },
        state: "open",
        merged: false,
      } as any,
      true,
    );
    expect(result).toContain("PR Title: Add feature");
    expect(result).toContain("PR Author: alice");
    expect(result).toContain("PR Branch: feature -> main");
  });

  test("Issue context", () => {
    const result = formatContext(
      {
        title: "Bug",
        user: { login: "bob" },
        state: "open",
      } as any,
      false,
    );
    expect(result).toContain("Issue Title: Bug");
    expect(result).toContain("Issue Author: bob");
  });
});

describe("formatBody", () => {
  test("replaces image URLs and sanitizes", () => {
    const body = "See ![img](https://example.com/img.png)";
    const result = formatBody(body, imageMap);
    expect(result).toContain("/tmp/gitea-images/img.png");
  });
});

describe("formatComments", () => {
  test("formats comments with author and time", () => {
    const comments = [
      {
        id: 1,
        body: "hello",
        user: { login: "alice" },
        created_at: "2024-01-01T00:00:00Z",
      },
    ];
    const result = formatComments(comments as any, imageMap);
    expect(result).toContain("[alice at 2024-01-01T00:00:00Z]: hello");
  });
});

describe("formatReviewComments", () => {
  test("formats review body", () => {
    const reviewData = {
      nodes: [
        {
          id: 1,
          user: { login: "reviewer" },
          submitted_at: "2024-01-01T01:00:00Z",
          state: "commented",
          body: "Looks good",
        },
      ],
    };
    const result = formatReviewComments(reviewData as any, imageMap);
    expect(result).toContain("Review by reviewer");
    expect(result).toContain("Looks good");
  });
});

describe("formatChangedFilesWithSHA", () => {
  test("formats file list with sha", () => {
    const files = [
      {
        filename: "src/a.ts",
        status: "modified",
        additions: 1,
        deletions: 0,
        sha: "abc",
      },
    ];
    const result = formatChangedFilesWithSHA(files as any);
    expect(result).toBe("- src/a.ts (modified) +1/-0 SHA: abc");
  });
});
