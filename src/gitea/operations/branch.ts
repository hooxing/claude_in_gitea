#!/usr/bin/env bun

import { $ } from "bun";
import { execFileSync } from "child_process";
import type { ParsedGiteaContext } from "../context";
import type { GiteaPullRequest, GiteaRepo, GiteaBranch } from "../types";
import type { GiteaClient } from "../api/client";
import type { FetchDataResult } from "../data/fetcher";
import { generateBranchName } from "../../utils/branch-template";

function extractFirstLabel(giteaData: FetchDataResult): string | undefined {
  const labels = (giteaData.contextData as any).labels;
  return labels && labels.length > 0 ? labels[0]?.name : undefined;
}

export function validateBranchName(branchName: string): void {
  if (!branchName || branchName.trim().length === 0) {
    throw new Error("Branch name cannot be empty");
  }
  if (branchName.startsWith("-")) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names cannot start with a dash.`,
    );
  }
  if (/[^\x20-\x7E]/.test(branchName)) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names cannot contain control characters.`,
    );
  }
  const validPattern = /^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/;
  if (!validPattern.test(branchName)) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names must start with an alphanumeric character and contain only alphanumeric characters, forward slashes, hyphens, underscores, or periods.`,
    );
  }
  if (branchName.startsWith(".") || branchName.endsWith(".")) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names cannot start or end with a period.`,
    );
  }
  if (branchName.endsWith("/")) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names cannot end with a slash.`,
    );
  }
  if (branchName.includes("//")) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names cannot contain consecutive slashes.`,
    );
  }
  if (branchName.includes("..")) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names cannot contain '..'`,
    );
  }
  if (branchName.endsWith(".lock")) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names cannot end with '.lock'`,
    );
  }
  if (branchName.includes("@{")) {
    throw new Error(
      `Invalid branch name: "${branchName}". Branch names cannot contain '@{'`,
    );
  }
}

function execGit(args: string[]): void {
  execFileSync("git", args, { stdio: "inherit" });
}

export type BranchInfo = {
  baseBranch: string;
  claudeBranch?: string;
  currentBranch: string;
};

export async function setupBranch(
  client: GiteaClient,
  giteaData: FetchDataResult,
  context: ParsedGiteaContext,
): Promise<BranchInfo> {
  const { owner, repo } = context.repository;
  const entityNumber = context.entityNumber;
  const { baseBranch, branchPrefix, branchNameTemplate } = context.inputs;
  const isPR = context.isPR;

  if (isPR) {
    const prData = giteaData.contextData as GiteaPullRequest;
    const prState = prData.state;

    if (prState === "closed" || prData.merged) {
      console.log(
        `PR #${entityNumber} is closed or merged, creating new branch from base...`,
      );
    } else {
      console.log("This is an open PR, checking out PR branch...");
      const branchName = prData.head.ref;
      validateBranchName(branchName);

      execGit(["fetch", "origin", branchName]);
      execGit(["checkout", branchName, "--"]);

      return {
        baseBranch: prData.base.ref,
        currentBranch: branchName,
      };
    }
  }

  let sourceBranch: string;
  if (baseBranch) {
    sourceBranch = baseBranch;
  } else {
    const repoInfo = await client.get<GiteaRepo>(
      `/repos/${owner}/${repo}`,
    );
    sourceBranch = repoInfo.default_branch;
  }

  let sourceSHA: string | undefined;
  try {
    const branchInfo = await client.get<GiteaBranch>(
      `/repos/${owner}/${repo}/branches/${sourceBranch}`,
    );
    sourceSHA = branchInfo.commit.id;
  } catch (error) {
    console.warn("Failed to fetch branch SHA from API, continuing without SHA");
  }

  const firstLabel = extractFirstLabel(giteaData);
  const title = giteaData.contextData.title;

  let newBranch = generateBranchName(
    branchNameTemplate,
    branchPrefix,
    isPR ? "pr" : "issue",
    entityNumber,
    sourceSHA,
    firstLabel,
    title,
  );

  try {
    await $`git ls-remote --exit-code origin refs/heads/${newBranch}`.quiet();
    console.log(
      `Branch '${newBranch}' already exists, falling back to default format`,
    );
    newBranch = generateBranchName(
      undefined,
      branchPrefix,
      isPR ? "pr" : "issue",
      entityNumber,
      sourceSHA,
      firstLabel,
      title,
    );
  } catch {
    // branch doesn't exist
  }

  if (context.inputs.useCommitSigning) {
    console.log(
      `Branch name generated: ${newBranch} (will be created by file ops server on first commit)`,
    );

    validateBranchName(sourceBranch);
    execGit(["fetch", "origin", sourceBranch, "--depth=1"]);
    execGit(["checkout", sourceBranch, "--"]);

    return {
      baseBranch: sourceBranch,
      claudeBranch: newBranch,
      currentBranch: sourceBranch,
    };
  }

  console.log(
    `Creating local branch ${newBranch} from source branch: ${sourceBranch}...`,
  );

  validateBranchName(sourceBranch);
  validateBranchName(newBranch);
  execGit(["fetch", "origin", sourceBranch, "--depth=1"]);
  execGit(["checkout", sourceBranch, "--"]);
  execGit(["checkout", "-b", newBranch]);

  return {
    baseBranch: sourceBranch,
    claudeBranch: newBranch,
    currentBranch: newBranch,
  };
}
