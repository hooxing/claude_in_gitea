#!/usr/bin/env bun

import * as core from "../../utils/action-io";
import {
  isIssuesEvent,
  isIssuesAssignedEvent,
  isIssueCommentEvent,
  isPullRequestEvent,
  isPullRequestReviewEvent,
  isPullRequestReviewCommentEvent,
} from "../context";
import type { ParsedGiteaContext } from "../context";

export function checkContainsTrigger(context: ParsedGiteaContext): boolean {
  const {
    inputs: { assigneeTrigger, labelTrigger, triggerPhrase, prompt },
  } = context;
  const normalizedTriggerPhrase = triggerPhrase.trim();

  if (prompt) {
    core.info("Prompt provided, triggering action");
    return true;
  }

  if (isIssuesAssignedEvent(context)) {
    const triggerUser = assigneeTrigger.replace(/^@/, "");
    const assigneeUsername =
      (context.payload as any).issue?.assignee?.login || "";
    if (triggerUser && assigneeUsername === triggerUser) {
      core.info(`Issue assigned to trigger user '${triggerUser}'`);
      return true;
    }
  }

  if (isIssuesEvent(context) && context.eventAction === "labeled") {
    const labelName = (context.payload as any).label?.name || "";
    if (labelTrigger && labelName === labelTrigger) {
      core.info(`Issue labeled with trigger label '${labelTrigger}'`);
      return true;
    }
  }

  if (
    isIssuesEvent(context) &&
    context.eventAction === "opened" &&
    normalizedTriggerPhrase
  ) {
    const issueBody = (context.payload as any).issue?.body || "";
    const issueTitle = (context.payload as any).issue?.title || "";
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(normalizedTriggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(issueBody)) {
      core.info(
        `Issue body contains exact trigger phrase '${normalizedTriggerPhrase}'`,
      );
      return true;
    }
    if (regex.test(issueTitle)) {
      core.info(
        `Issue title contains exact trigger phrase '${normalizedTriggerPhrase}'`,
      );
      return true;
    }
  }

  if (isPullRequestEvent(context) && normalizedTriggerPhrase) {
    const prBody = (context.payload as any).pull_request?.body || "";
    const prTitle = (context.payload as any).pull_request?.title || "";
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(normalizedTriggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(prBody)) {
      core.info(
        `Pull request body contains exact trigger phrase '${normalizedTriggerPhrase}'`,
      );
      return true;
    }
    if (regex.test(prTitle)) {
      core.info(
        `Pull request title contains exact trigger phrase '${normalizedTriggerPhrase}'`,
      );
      return true;
    }
  }

  if (isPullRequestReviewEvent(context) && normalizedTriggerPhrase) {
    const reviewBody =
      (context.payload as any).review?.body ||
      (context.payload as any).review?.content ||
      "";
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(normalizedTriggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(reviewBody)) {
      core.info(
        `Pull request review contains exact trigger phrase '${normalizedTriggerPhrase}'`,
      );
      return true;
    }
  }

  if (
    (isIssueCommentEvent(context) || isPullRequestReviewCommentEvent(context)) &&
    normalizedTriggerPhrase
  ) {
    const commentBody =
      (context.payload as any).comment?.body ||
      (context.payload as any).review?.content ||
      "";
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(normalizedTriggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(commentBody)) {
      core.info(
        `Comment contains exact trigger phrase '${normalizedTriggerPhrase}'`,
      );
      return true;
    }
  }

  if (!normalizedTriggerPhrase) {
    core.info("No trigger phrase configured; comment/body triggers are disabled");
  } else {
    core.info(`No trigger was met for ${normalizedTriggerPhrase}`);
  }
  return false;
}

export function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function checkTriggerAction(context: ParsedGiteaContext) {
  const containsTrigger = checkContainsTrigger(context);
  core.setOutput("contains_trigger", containsTrigger.toString());
  return containsTrigger;
}

