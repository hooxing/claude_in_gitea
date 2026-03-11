#!/usr/bin/env bun

/**
 * Create the initial tracking comment when Claude Code starts working
 */

import { createJobRunLink, createCommentBody } from "./common";
import { type ParsedGiteaContext } from "../../context";
import type { GiteaClient } from "../../api/client";
import { setOutput } from "../../../utils/action-io";

export async function createInitialComment(
  client: GiteaClient,
  context: ParsedGiteaContext,
) {
  const { owner, repo } = context.repository;

  const jobRunLink = createJobRunLink(owner, repo, context.runId);
  const initialBody = createCommentBody(jobRunLink);

  try {
    let response;

    if (context.inputs.useStickyComment && context.isPR) {
      const comments = await client.get<any[]>(
        `/repos/${owner}/${repo}/issues/${context.entityNumber}/comments`,
      );
      const expectedBotId = parseInt(context.inputs.botId, 10);
      const expectedBotName = context.inputs.botName.toLowerCase();
      const existingComment = comments.find((comment) => {
        const idMatch =
          Number.isFinite(expectedBotId) && expectedBotId > 0
            ? comment.user?.id === expectedBotId
            : false;
        const botNameMatch = comment.user?.login
          ? comment.user.login.toLowerCase() === expectedBotName ||
            comment.user.login.toLowerCase().includes(expectedBotName)
          : false;
        const bodyMatch = comment.body === initialBody;
        return idMatch || botNameMatch || bodyMatch;
      });

      if (existingComment) {
        response = await client.patch(
          `/repos/${owner}/${repo}/issues/comments/${existingComment.id}`,
          { body: initialBody },
        );
      } else {
        response = await client.post(
          `/repos/${owner}/${repo}/issues/${context.entityNumber}/comments`,
          { body: initialBody },
        );
      }
    } else {
      response = await client.post(
        `/repos/${owner}/${repo}/issues/${context.entityNumber}/comments`,
        { body: initialBody },
      );
    }

    setOutput("claude_comment_id", String(response.id));
    console.log(`Created initial comment with ID: ${response.id}`);
    return response;
  } catch (error) {
    console.error("Error in initial comment:", error);
    throw error;
  }
}
