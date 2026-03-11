import { describe, test, expect } from "bun:test";
import { updateClaudeComment } from "../src/gitea/operations/comments/update-claude-comment";

const createClient = () => {
  const calls: any[] = [];
  return {
    calls,
    patch: async (path: string, body: any) => {
      calls.push({ path, body });
      return { id: 123, html_url: "https://gitea.example.com/owner/repo/issues/1#issuecomment-123" };
    },
  } as any;
};

describe("updateClaudeComment (Gitea)", () => {
  test("updates issue comment", async () => {
    const client = createClient();
    const result = await updateClaudeComment(client, {
      owner: "owner",
      repo: "repo",
      commentId: 123,
      body: "updated",
      isPullRequestReviewComment: false,
    });

    expect(result.id).toBe(123);
    expect(result.html_url).toContain("issuecomment-123");
    expect(client.calls[0].path).toBe("/repos/owner/repo/issues/comments/123");
    expect(client.calls[0].body).toEqual({ body: "updated" });
  });
});
