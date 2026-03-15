import type { GiteaClient } from "../api/client";
import { GITEA_SERVER_URL } from "../api/config";

export async function checkAndCommitOrDeleteBranch(
  client: GiteaClient,
  owner: string,
  repo: string,
  claudeBranch: string | undefined,
  baseBranch: string,
  _useCommitSigning: boolean,
): Promise<{ shouldDeleteBranch: boolean; branchLink: string }> {
  let branchLink = "";

  if (!claudeBranch) {
    return { shouldDeleteBranch: false, branchLink: "" };
  }

  try {
    await client.get(`/repos/${owner}/${repo}/branches/${claudeBranch}`);
  } catch {
    return { shouldDeleteBranch: false, branchLink: "" };
  }

  let shouldDeleteBranch = false;
  try {
    const compare = await client.get<{
      ahead_by?: number;
      behind_by?: number;
      total_commits?: number;
      files?: unknown[];
    }>(`/repos/${owner}/${repo}/compare/${baseBranch}...${claudeBranch}`);

    const aheadBy = compare.ahead_by ?? 0;
    const totalCommits = compare.total_commits ?? 0;
    const filesCount = compare.files?.length ?? 0;

    if (aheadBy === 0 || totalCommits === 0 || filesCount === 0) {
      shouldDeleteBranch = true;
    }
  } catch {
    // If compare fails, keep the branch
    shouldDeleteBranch = false;
  }

  if (shouldDeleteBranch) {
    try {
      await client.delete(
        `/repos/${owner}/${repo}/branches/${claudeBranch}`,
      );
    } catch {
      // If deletion fails, keep the branch and show link
      shouldDeleteBranch = false;
    }
  }

  if (!shouldDeleteBranch) {
    const branchUrl = `${GITEA_SERVER_URL}/${owner}/${repo}/src/branch/${claudeBranch}`;
    branchLink = `\n[View branch](${branchUrl})`;
  }

  return { shouldDeleteBranch, branchLink };
}
