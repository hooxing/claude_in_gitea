import type { GiteaClient } from "../../api/client";

export type UpdateClaudeCommentParams = {
  owner: string;
  repo: string;
  commentId: number;
  body: string;
  isPullRequestReviewComment: boolean;
};

export type UpdateClaudeCommentResult = {
  id: number;
  html_url?: string;
  updated_at?: string;
};

export async function updateClaudeComment(
  client: GiteaClient,
  params: UpdateClaudeCommentParams,
): Promise<UpdateClaudeCommentResult> {
  const { owner, repo, commentId, body } = params;

  const result = await client.patch<{
    id: number;
    html_url?: string;
    updated_at?: string;
  }>(`/repos/${owner}/${repo}/issues/comments/${commentId}`, { body });

  return {
    id: result.id,
    html_url: result.html_url,
    updated_at: result.updated_at,
  };
}
