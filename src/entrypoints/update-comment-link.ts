#!/usr/bin/env bun

import { createGiteaClient } from "../gitea/api/client";
import type { GiteaClient } from "../gitea/api/client";
import * as fs from "fs/promises";
import {
  updateCommentBody,
  type CommentUpdateInput,
} from "../gitea/operations/comment-logic";
import {
  parseGiteaContext,
  isEntityContext,
} from "../gitea/context";
import type { ParsedGiteaContext } from "../gitea/context";
import { GITEA_SERVER_URL } from "../gitea/api/config";
import { checkAndCommitOrDeleteBranch } from "../gitea/operations/branch-cleanup";
import { updateClaudeComment } from "../gitea/operations/comments/update-claude-comment";

export type UpdateCommentLinkParams = {
  commentId: number;
  giteaToken: string;
  claudeBranch?: string;
  baseBranch: string;
  triggerUsername?: string;
  context: ParsedGiteaContext;
  client: GiteaClient;
  claudeSuccess: boolean;
  outputFile?: string;
  prepareSuccess: boolean;
  prepareError?: string;
  useCommitSigning: boolean;
};

function buildPrLink(baseBranch: string, headBranch: string, repo: string): string {
  const template = process.env.GITEA_PR_URL_TEMPLATE;
  if (template) {
    return template
      .replace("{repo}", repo)
      .replace("{base}", baseBranch)
      .replace("{head}", headBranch);
  }
  return `${GITEA_SERVER_URL}/${repo}/compare/${baseBranch}...${headBranch}`;
}

export async function updateCommentLink(
  params: UpdateCommentLinkParams,
): Promise<void> {
  const {
    commentId,
    claudeBranch,
    baseBranch,
    triggerUsername,
    context,
    client,
    useCommitSigning,
  } = params;

  const { owner, repo } = context.repository;

  const jobUrl =
    process.env.JOB_URL ||
    `${GITEA_SERVER_URL}/${owner}/${repo}/actions/runs/${process.env.GITEA_RUN_ID || process.env.GITHUB_RUN_ID}`;

  const comment = await client.get<{ body?: string }>(
    `/repos/${owner}/${repo}/issues/comments/${commentId}`,
  );

  const currentBody = comment.body ?? "";

  const { shouldDeleteBranch, branchLink } = await checkAndCommitOrDeleteBranch(
    client,
    owner,
    repo,
    claudeBranch,
    baseBranch,
    useCommitSigning,
  );

  let prLink = "";
  if (claudeBranch && !shouldDeleteBranch) {
    const prUrl = buildPrLink(baseBranch, claudeBranch, `${owner}/${repo}`);
    prLink = `\n[Create a PR](${prUrl})`;
  }

  let executionDetails: {
    total_cost_usd?: number;
    duration_ms?: number;
    duration_api_ms?: number;
  } | null = null;
  let actionFailed = false;
  let errorDetails: string | undefined;

  if (!params.prepareSuccess && params.prepareError) {
    actionFailed = true;
    errorDetails = params.prepareError;
  } else {
    try {
      if (params.outputFile) {
        const fileContent = await fs.readFile(params.outputFile, "utf8");
        const outputData = JSON.parse(fileContent);
        if (Array.isArray(outputData) && outputData.length > 0) {
          const lastElement = outputData[outputData.length - 1];
          if (
            lastElement.type === "result" &&
            "total_cost_usd" in lastElement &&
            "duration_ms" in lastElement
          ) {
            executionDetails = {
              total_cost_usd: lastElement.total_cost_usd,
              duration_ms: lastElement.duration_ms,
              duration_api_ms: lastElement.duration_api_ms,
            };
          }
        }
      }
      actionFailed = !params.claudeSuccess;
    } catch {
      actionFailed = !params.claudeSuccess;
    }
  }

  const commentInput: CommentUpdateInput = {
    currentBody,
    actionFailed,
    executionDetails,
    jobUrl,
    branchLink,
    prLink,
    branchName: shouldDeleteBranch || !branchLink ? undefined : claudeBranch,
    triggerUsername,
    errorDetails,
  };

  const updatedBody = updateCommentBody(commentInput);

  await updateClaudeComment(client, {
    owner,
    repo,
    commentId,
    body: updatedBody,
    isPullRequestReviewComment: false,
  });
}

async function run() {
  const context = parseGiteaContext();
  if (!isEntityContext(context)) {
    throw new Error("update-comment-link requires an entity context");
  }

  const giteaToken = process.env.GITEA_TOKEN || process.env.GITHUB_TOKEN;
  if (!giteaToken) {
    throw new Error("GITEA_TOKEN is required");
  }

  const client = createGiteaClient(giteaToken);

  await updateCommentLink({
    commentId: parseInt(process.env.CLAUDE_COMMENT_ID || "0", 10),
    giteaToken,
    claudeBranch: process.env.CLAUDE_BRANCH,
    baseBranch: process.env.BASE_BRANCH || "main",
    triggerUsername: process.env.TRIGGER_USERNAME,
    context,
    client,
    claudeSuccess: process.env.CLAUDE_SUCCESS !== "false",
    outputFile: process.env.OUTPUT_FILE,
    prepareSuccess: process.env.PREPARE_SUCCESS !== "false",
    prepareError: process.env.PREPARE_ERROR,
    useCommitSigning: process.env.USE_COMMIT_SIGNING === "true",
  });
}

if (import.meta.main) {
  run().catch((error) => {
    console.error("Error updating comment with job link:", error);
    process.exit(1);
  });
}
