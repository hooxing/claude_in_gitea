import type { GiteaContext } from "../gitea/context";
import {
  isEntityContext,
  isIssueCommentEvent,
  isPullRequestReviewCommentEvent,
  isPullRequestEvent,
  isIssuesEvent,
  isPullRequestReviewEvent,
} from "../gitea/context";
import { checkContainsTrigger } from "../gitea/validation/trigger";

export type AutoDetectedMode = "tag" | "agent";

export function detectMode(context: GiteaContext): AutoDetectedMode {
  if (context.inputs.trackProgress) {
    validateTrackProgressEvent(context);
  }

  if (context.inputs.trackProgress && isEntityContext(context)) {
    if (
      isPullRequestEvent(context) ||
      isIssuesEvent(context) ||
      isIssueCommentEvent(context) ||
      isPullRequestReviewCommentEvent(context) ||
      isPullRequestReviewEvent(context)
    ) {
      return "tag";
    }
  }

  if (isEntityContext(context)) {
    if (
      isIssueCommentEvent(context) ||
      isPullRequestReviewCommentEvent(context) ||
      isPullRequestReviewEvent(context)
    ) {
      if (context.inputs.prompt) {
        return "agent";
      }
      if (checkContainsTrigger(context)) {
        return "tag";
      }
    }
  }

  if (isEntityContext(context) && isIssuesEvent(context)) {
    if (context.inputs.prompt) {
      return "agent";
    }
    if (checkContainsTrigger(context)) {
      return "tag";
    }
  }

  if (isEntityContext(context) && isPullRequestEvent(context)) {
    const supportedActions = [
      "opened",
      "synchronize",
      "ready_for_review",
      "reopened",
    ];
    if (context.eventAction && supportedActions.includes(context.eventAction)) {
      if (context.inputs.prompt) {
        return "agent";
      }
    }
  }

  return "agent";
}

function validateTrackProgressEvent(context: GiteaContext): void {
  const validEvents = [
    "pull_request",
    "issues",
    "issue_comment",
    "pull_request_review_comment",
    "pull_request_review",
    "pull_request_comment",
    "pull_request_approved",
  ];
  if (!validEvents.includes(context.eventName)) {
    throw new Error(
      `track_progress is only supported for events: ${validEvents.join(", ")}. ` +
        `Current event: ${context.eventName}`,
    );
  }

  if (context.eventName === "pull_request" && context.eventAction) {
    const validActions = [
      "opened",
      "synchronize",
      "ready_for_review",
      "reopened",
    ];
    if (!validActions.includes(context.eventAction)) {
      throw new Error(
        `track_progress for pull_request events is only supported for actions: ` +
          `${validActions.join(", ")}. Current action: ${context.eventAction}`,
      );
    }
  }
}
