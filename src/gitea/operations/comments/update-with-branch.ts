#!/usr/bin/env bun

/**
 * Update the initial tracking comment with branch link
 */

import {
  createJobRunLink,
  createBranchLink,
  createCommentBody,
} from "./common";
import type { GiteaClient } from "../../api/client";
import { type ParsedGiteaContext } from "../../context";
import { updateClaudeComment } from "./update-claude-comment";
import { info, warning } from "../../../utils/action-io";

export async function updateTrackingComment(
  client: GiteaClient,
  context: ParsedGiteaContext,
  commentId: number,
  branch?: string,
) {
  const { owner, repo } = context.repository;

  const jobRunLink = createJobRunLink(owner, repo, context.runId);
  let branchLink = "";
  if (branch && !context.isPR) {
    branchLink = createBranchLink(owner, repo, branch);
  }

  const updatedBody = createCommentBody(jobRunLink, branchLink);

  try {
    await updateClaudeComment(client, {
      owner,
      repo,
      commentId,
      body: updatedBody,
      isPullRequestReviewComment: false,
    });

    info(`Updated comment ${commentId} with branch link`);
  } catch (error) {
    warning(`Error updating comment with branch link: ${error}`);
    throw error;
  }
}
