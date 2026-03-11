#!/usr/bin/env bun

import * as core from "../utils/action-io";
import { writeFile, mkdir } from "fs/promises";
import type { FetchDataResult } from "../gitea/data/fetcher";
import {
  formatContext,
  formatBody,
  formatComments,
  formatReviewComments,
  formatChangedFilesWithSHA,
} from "../gitea/data/formatter";
import { sanitizeContent } from "../gitea/utils/sanitizer";
import {
  isIssuesEvent,
  isIssueCommentEvent,
  isPullRequestReviewEvent,
  isPullRequestReviewCommentEvent,
} from "../gitea/context";
import type { ParsedGiteaContext } from "../gitea/context";
import type { CommonFields, PreparedContext, EventData } from "./types";
import { GITEA_SERVER_URL } from "../gitea/api/config";
import { extractUserRequest } from "../utils/extract-user-request";
export type { CommonFields, PreparedContext } from "./types";

const USER_REQUEST_FILENAME = "claude-user-request.txt";

const BASE_ALLOWED_TOOLS = ["Edit", "MultiEdit", "Glob", "Grep", "LS", "Read", "Write"];

export function buildAllowedToolsString(
  customAllowedTools?: string[],
  includeActionsTools: boolean = false,
  useCommitSigning: boolean = false,
): string {
  let baseTools = [...BASE_ALLOWED_TOOLS];

  baseTools.push("mcp__gitea_comment__update_claude_comment");

  if (useCommitSigning) {
    baseTools.push(
      "mcp__gitea_file_ops__commit_files",
      "mcp__gitea_file_ops__delete_files",
    );
  } else {
    baseTools.push(
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git rm:*)",
    );
  }

  if (includeActionsTools) {
    baseTools.push(
      "mcp__gitea_ci__get_ci_status",
      "mcp__gitea_ci__get_workflow_run_details",
      "mcp__gitea_ci__download_job_log",
    );
  }

  let allAllowedTools = baseTools.join(",");
  if (customAllowedTools && customAllowedTools.length > 0) {
    allAllowedTools = `${allAllowedTools},${customAllowedTools.join(",")}`;
  }
  return allAllowedTools;
}

export function buildDisallowedToolsString(
  customDisallowedTools?: string[],
  allowedTools?: string[],
): string {
  let disallowedTools = ["WebSearch", "WebFetch"];

  if (allowedTools && allowedTools.length > 0) {
    disallowedTools = disallowedTools.filter(
      (tool) => !allowedTools.includes(tool),
    );
  }

  let allDisallowedTools = disallowedTools.join(",");
  if (customDisallowedTools && customDisallowedTools.length > 0) {
    if (allDisallowedTools) {
      allDisallowedTools = `${allDisallowedTools},${customDisallowedTools.join(",")}`;
    } else {
      allDisallowedTools = customDisallowedTools.join(",");
    }
  }
  return allDisallowedTools;
}

export function prepareContext(
  context: ParsedGiteaContext,
  claudeCommentId: string,
  baseBranch?: string,
  claudeBranch?: string,
): PreparedContext {
  const repository = context.repository.full_name;
  const eventName = context.eventName;
  const eventAction = context.eventAction;
  const triggerPhrase = context.inputs.triggerPhrase || "@claude";
  const assigneeTrigger = context.inputs.assigneeTrigger;
  const labelTrigger = context.inputs.labelTrigger;
  const prompt = context.inputs.prompt;
  const isPR = context.isPR;

  const prNumber = isPR ? context.entityNumber.toString() : undefined;
  const issueNumber = !isPR ? context.entityNumber.toString() : undefined;

  let triggerUsername: string | undefined;
  let commentId: string | undefined;
  let commentBody: string | undefined;

  if (isIssueCommentEvent(context)) {
    commentId = context.payload.comment.id.toString();
    commentBody = context.payload.comment.body;
    triggerUsername = context.payload.comment.user.login;
  } else if (isPullRequestReviewEvent(context)) {
    const review = context.payload.review;
    commentBody = review?.body ?? review?.content ?? "";
    triggerUsername =
      review?.user?.login ||
      context.payload.sender?.login ||
      context.actor ||
      undefined;
  } else if (isPullRequestReviewCommentEvent(context)) {
    const reviewComment = context.payload.comment;
    const review = context.payload.review;
    commentId = reviewComment?.id?.toString();
    commentBody = reviewComment?.body ?? review?.content ?? "";
    triggerUsername =
      reviewComment?.user?.login ||
      review?.user?.login ||
      context.payload.sender?.login ||
      context.actor ||
      undefined;
  } else if (isIssuesEvent(context)) {
    triggerUsername = context.payload.issue.user?.login;
  }

  const commonFields: CommonFields = {
    repository,
    claudeCommentId,
    triggerPhrase,
    ...(triggerUsername && { triggerUsername }),
    ...(prompt && { prompt }),
    ...(claudeBranch && { claudeBranch }),
  };

  let eventData: EventData;

  switch (eventName) {
    case "pull_request_review_comment":
    case "pull_request_comment":
      if (!prNumber) throw new Error("PR_NUMBER is required");
      const reviewCommentBody = commentBody ?? "";
      eventData = {
        eventName,
        isPR: true,
        prNumber,
        ...(commentId && { commentId }),
        commentBody: reviewCommentBody,
        ...(claudeBranch && { claudeBranch }),
        ...(baseBranch && { baseBranch }),
      };
      break;

    case "pull_request_review":
    case "pull_request_approved":
      if (!prNumber) throw new Error("PR_NUMBER is required");
      eventData = {
        eventName,
        isPR: true,
        prNumber,
        commentBody,
        ...(claudeBranch && { claudeBranch }),
        ...(baseBranch && { baseBranch }),
      };
      break;

    case "issue_comment":
      if (!commentId) throw new Error("COMMENT_ID is required");
      if (!commentBody) throw new Error("COMMENT_BODY is required");
      if (isPR) {
        if (!prNumber) throw new Error("PR_NUMBER is required for PR comments");
        eventData = {
          eventName: "issue_comment",
          commentId,
          isPR: true,
          prNumber,
          commentBody,
          ...(claudeBranch && { claudeBranch }),
          ...(baseBranch && { baseBranch }),
        };
      } else {
        if (!claudeBranch) throw new Error("CLAUDE_BRANCH is required");
        if (!baseBranch) throw new Error("BASE_BRANCH is required");
        if (!issueNumber) throw new Error("ISSUE_NUMBER is required");
        eventData = {
          eventName: "issue_comment",
          commentId,
          isPR: false,
          claudeBranch,
          baseBranch,
          issueNumber,
          commentBody,
        };
      }
      break;

    case "issues":
      if (!eventAction) throw new Error("EVENT_ACTION is required");
      if (!issueNumber) throw new Error("ISSUE_NUMBER is required");
      if (!baseBranch) throw new Error("BASE_BRANCH is required");
      if (!claudeBranch) throw new Error("CLAUDE_BRANCH is required");

      if (eventAction === "assigned") {
        eventData = {
          eventName: "issues",
          eventAction: "assigned",
          isPR: false,
          issueNumber,
          baseBranch,
          claudeBranch,
          ...(assigneeTrigger && { assigneeTrigger }),
        };
      } else if (eventAction === "labeled") {
        eventData = {
          eventName: "issues",
          eventAction: "labeled",
          isPR: false,
          issueNumber,
          baseBranch,
          claudeBranch,
          labelTrigger,
        } as any;
      } else if (eventAction === "opened") {
        eventData = {
          eventName: "issues",
          eventAction: "opened",
          isPR: false,
          issueNumber,
          baseBranch,
          claudeBranch,
        };
      } else {
        throw new Error(`Unsupported issue action: ${eventAction}`);
      }
      break;

    case "pull_request":
      if (!prNumber) throw new Error("PR_NUMBER is required");
      eventData = {
        eventName: "pull_request",
        eventAction: eventAction,
        isPR: true,
        prNumber,
        ...(claudeBranch && { claudeBranch }),
        ...(baseBranch && { baseBranch }),
      };
      break;

    default:
      throw new Error(`Unsupported event type: ${eventName}`);
  }

  return {
    ...commonFields,
    eventData,
    giteaContext: context,
  };
}

function getCommitInstructions(
  eventData: EventData,
  giteaData: FetchDataResult,
  context: PreparedContext,
  useCommitSigning: boolean,
): string {
  const host = new URL(GITEA_SERVER_URL).hostname;
  const coAuthorLine =
    (giteaData.triggerDisplayName ?? context.triggerUsername) &&
    context.triggerUsername !== "Unknown"
      ? `Co-authored-by: ${giteaData.triggerDisplayName ?? context.triggerUsername} <${context.triggerUsername}@${host}>`
      : "";

  if (useCommitSigning) {
    return `
- 使用 mcp__gitea_file_ops__commit_files 提交（支持单/多文件）。
- 需要删除文件时使用 mcp__gitea_file_ops__delete_files。
- 如果触发用户可识别，请在提交信息中追加 Co-authored-by：
  ${coAuthorLine}`;
  }

  const branchName = (eventData as any).claudeBranch || (eventData as any).baseBranch;
  return `
- 使用 git CLI 提交：
  - Bash(git add <files>)
  - Bash(git commit -m "<message>")
  - Bash(git push origin ${branchName || "HEAD"})
${coAuthorLine ? `- 提交信息追加：\n  ${coAuthorLine}` : ""}`;
}

function buildPrLink(baseBranch: string, headBranch: string, repository: string): string {
  const template = process.env.GITEA_PR_URL_TEMPLATE;
  if (template) {
    return template
      .replace("{repo}", repository)
      .replace("{base}", baseBranch)
      .replace("{head}", headBranch);
  }
  return `${GITEA_SERVER_URL}/${repository}/compare/${baseBranch}...${headBranch}`;
}

export function generatePrompt(
  context: PreparedContext,
  giteaData: FetchDataResult,
  useCommitSigning: boolean,
  modeName: "tag" | "agent",
): string {
  if (modeName === "agent") {
    return context.prompt || `Repository: ${context.repository}`;
  }

  const { contextData, comments, changedFilesWithSHA, reviewData, imageUrlMap } = giteaData;
  const { eventData } = context;

  const formattedContext = formatContext(contextData, eventData.isPR);
  const formattedBody = contextData?.body ? formatBody(contextData.body, imageUrlMap) : "No description provided";
  const formattedComments = formatComments(comments, imageUrlMap);
  const formattedReviewComments = eventData.isPR ? formatReviewComments(reviewData, imageUrlMap) : "";
  const formattedChangedFiles = eventData.isPR ? formatChangedFilesWithSHA(changedFilesWithSHA) : "";

  const jobUrl =
    process.env.JOB_URL ||
    `${GITEA_SERVER_URL}/${context.repository}/actions/runs/${process.env.GITEA_RUN_ID || process.env.GITHUB_RUN_ID}`;

  const triggerContext = eventData.eventName;

  const prLink =
    eventData.isPR && (eventData as any).claudeBranch
      ? buildPrLink((eventData as any).baseBranch, (eventData as any).claudeBranch, context.repository)
      : "";

  return `你运行在 Gitea Actions (act_runner) 环境。请基于以下上下文完成任务：

<context>
${formattedContext}
</context>

<${eventData.isPR ? "pr" : "issue"}_body>
${formattedBody}
</${eventData.isPR ? "pr" : "issue"}_body>

<comments>
${formattedComments || "No comments"}
</comments>
${eventData.isPR ? `
<review_comments>
${formattedReviewComments || "No review comments"}
</review_comments>

<changed_files>
${formattedChangedFiles || "No files changed"}
</changed_files>` : ""}

<metadata>
repository: ${context.repository}
${eventData.isPR ? `pr_number: ${(eventData as any).prNumber}` : `issue_number: ${(eventData as any).issueNumber}`}
trigger: ${triggerContext}
triggered_by: ${context.triggerUsername ?? "Unknown"}
claude_comment_id: ${context.claudeCommentId}
</metadata>
${(eventData as any).commentBody ? `
<trigger_comment>
${sanitizeContent((eventData as any).commentBody)}
</trigger_comment>` : ""}

约束与说明：
- 仅使用 Gitea REST API 或提供的 MCP 工具，不使用 GraphQL。
- 所有可见输出必须通过 mcp__gitea_comment__update_claude_comment 更新。
- Gitea inline review comment 使用 diff position，不是 GitHub 的 line/side。
- 如需行内评论，使用 mcp__gitea_inline_comment__create_inline_comment（可传 line+side 或 position）。

执行要求：
- 使用清单格式：- [ ] 未完成 / - [x] 已完成。
${getCommitInstructions(eventData, giteaData, context, useCommitSigning)}
${prLink ? `
如需创建 PR，请使用：
[Create a PR](${prLink})` : ""}

最后必须包含：
- Job 链接: ${jobUrl}
- 遵循仓库中的 CLAUDE.md 指引
`;
}

function extractUserRequestFromContext(
  context: PreparedContext,
  giteaData: FetchDataResult,
): string | null {
  const { eventData, triggerPhrase } = context;

  if (
    "commentBody" in eventData &&
    eventData.commentBody &&
    (eventData.eventName === "issue_comment" ||
      eventData.eventName === "pull_request_review_comment" ||
      eventData.eventName === "pull_request_comment" ||
      eventData.eventName === "pull_request_review" ||
      eventData.eventName === "pull_request_approved")
  ) {
    return extractUserRequest(eventData.commentBody, triggerPhrase);
  }

  if (giteaData.contextData?.body) {
    const request = extractUserRequest(
      giteaData.contextData.body,
      triggerPhrase,
    );
    if (request) return request;
  }

  return null;
}

export async function createPrompt(
  commentId: number,
  baseBranch: string | undefined,
  claudeBranch: string | undefined,
  giteaData: FetchDataResult,
  context: ParsedGiteaContext,
) {
  try {
    const claudeCommentId = commentId.toString();

    const preparedContext = prepareContext(
      context,
      claudeCommentId,
      baseBranch,
      claudeBranch,
    );

    await mkdir(`${process.env.RUNNER_TEMP || "/tmp"}/claude-prompts`, {
      recursive: true,
    });

    const promptContent = generatePrompt(
      preparedContext,
      giteaData,
      context.inputs.useCommitSigning,
      "tag",
    );

    await writeFile(
      `${process.env.RUNNER_TEMP || "/tmp"}/claude-prompts/claude-prompt.txt`,
      promptContent,
    );

    const userRequest = extractUserRequestFromContext(preparedContext, giteaData);
    if (userRequest) {
      await writeFile(
        `${process.env.RUNNER_TEMP || "/tmp"}/claude-prompts/${USER_REQUEST_FILENAME}`,
        userRequest,
      );
    }

    const allAllowedTools = buildAllowedToolsString(
      [],
      false,
      context.inputs.useCommitSigning,
    );
    const allDisallowedTools = buildDisallowedToolsString([], []);

    core.exportVariable("ALLOWED_TOOLS", allAllowedTools);
    core.exportVariable("DISALLOWED_TOOLS", allDisallowedTools);
  } catch (error) {
    core.setFailed(`Create prompt failed with error: ${error}`);
    process.exit(1);
  }
}
