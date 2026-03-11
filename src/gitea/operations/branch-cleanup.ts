import type { GiteaClient } from "../api/client";
import { GITEA_SERVER_URL } from "../api/config";

export async function checkAndCommitOrDeleteBranch(
  client: GiteaClient,
  owner: string,
  repo: string,
  claudeBranch: string | undefined,
  _baseBranch: string,
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

  const branchUrl = `${GITEA_SERVER_URL}/${owner}/${repo}/src/branch/${claudeBranch}`;
  branchLink = `\n[View branch](${branchUrl})`;

  return { shouldDeleteBranch: false, branchLink };
}
