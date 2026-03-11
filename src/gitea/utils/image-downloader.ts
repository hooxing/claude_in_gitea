import type { GiteaClient } from "../api/client";

export type CommentWithImages =
  | { type: "issue_comment"; id: string; body: string }
  | { type: "review_comment"; id: string; body: string }
  | { type: "review_body"; id: string; pullNumber: string; body: string }
  | { type: "issue_body"; issueNumber: string; body: string }
  | { type: "pr_body"; pullNumber: string; body: string };

/**
 * Gitea does not expose GitHub-style user-attachments or body_html.
 * For now, we skip image download and return an empty map.
 */
export async function downloadCommentImages(
  _client: GiteaClient,
  _owner: string,
  _repo: string,
  _comments: CommentWithImages[],
): Promise<Map<string, string>> {
  return new Map();
}
