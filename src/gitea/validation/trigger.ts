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

  if (prompt) {
    console.log("Prompt provided, triggering action");
    return true;
  }

  if (isIssuesAssignedEvent(context)) {
    const triggerUser = assigneeTrigger.replace(/^@/, "");
    const assigneeUsername =
      (context.payload as any).issue?.assignee?.login || "";
    if (triggerUser && assigneeUsername === triggerUser) {
      console.log(`Issue assigned to trigger user '${triggerUser}'`);
      return true;
    }
  }

  if (isIssuesEvent(context) && context.eventAction === "labeled") {
    const labelName = (context.payload as any).label?.name || "";
    if (labelTrigger && labelName === labelTrigger) {
      console.log(`Issue labeled with trigger label '${labelTrigger}'`);
      return true;
    }
  }

  if (isIssuesEvent(context) && context.eventAction === "opened") {
    const issueBody = (context.payload as any).issue?.body || "";
    const issueTitle = (context.payload as any).issue?.title || "";
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(issueBody)) {
      console.log(`Issue body contains exact trigger phrase '${triggerPhrase}'`);
      return true;
    }
    if (regex.test(issueTitle)) {
      console.log(`Issue title contains exact trigger phrase '${triggerPhrase}'`);
      return true;
    }
  }

  if (isPullRequestEvent(context)) {
    const prBody = (context.payload as any).pull_request?.body || "";
    const prTitle = (context.payload as any).pull_request?.title || "";
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(prBody)) {
      console.log(`Pull request body contains exact trigger phrase '${triggerPhrase}'`);
      return true;
    }
    if (regex.test(prTitle)) {
      console.log(`Pull request title contains exact trigger phrase '${triggerPhrase}'`);
      return true;
    }
  }

  if (isPullRequestReviewEvent(context)) {
    const reviewBody =
      (context.payload as any).review?.body ||
      (context.payload as any).review?.content ||
      "";
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(reviewBody)) {
      console.log(`Pull request review contains exact trigger phrase '${triggerPhrase}'`);
      return true;
    }
  }

  if (isIssueCommentEvent(context) || isPullRequestReviewCommentEvent(context)) {
    const commentBody =
      (context.payload as any).comment?.body ||
      (context.payload as any).review?.content ||
      "";
    const regex = new RegExp(
      `(^|\\s)${escapeRegExp(triggerPhrase)}([\\s.,!?;:]|$)`,
    );
    if (regex.test(commentBody)) {
      console.log(`Comment contains exact trigger phrase '${triggerPhrase}'`);
      return true;
    }
  }

  console.log(`No trigger was met for ${triggerPhrase}`);
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

