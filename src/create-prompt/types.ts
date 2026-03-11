import type { GiteaContext } from "../gitea/context";

export type CommonFields = {
  repository: string;
  claudeCommentId: string;
  triggerPhrase: string;
  triggerUsername?: string;
  prompt?: string;
  claudeBranch?: string;
};

type PullRequestReviewCommentEvent = {
  eventName: "pull_request_review_comment" | "pull_request_comment";
  isPR: true;
  prNumber: string;
  commentId?: string;
  commentBody: string;
  claudeBranch?: string;
  baseBranch?: string;
};

type PullRequestReviewEvent = {
  eventName: "pull_request_review" | "pull_request_approved";
  isPR: true;
  prNumber: string;
  commentBody?: string;
  claudeBranch?: string;
  baseBranch?: string;
};

type IssueCommentEvent = {
  eventName: "issue_comment";
  commentId: string;
  issueNumber: string;
  isPR: false;
  baseBranch: string;
  claudeBranch: string;
  commentBody: string;
};

// Not actually a real gitea event, since issue comments and PR comments are both sent as issue_comment
type PullRequestCommentEvent = {
  eventName: "issue_comment";
  commentId: string;
  prNumber: string;
  isPR: true;
  commentBody: string;
  claudeBranch?: string;
  baseBranch?: string;
};

type IssueOpenedEvent = {
  eventName: "issues";
  eventAction: "opened";
  isPR: false;
  issueNumber: string;
  baseBranch: string;
  claudeBranch: string;
};

type IssueAssignedEvent = {
  eventName: "issues";
  eventAction: "assigned";
  isPR: false;
  issueNumber: string;
  baseBranch: string;
  claudeBranch: string;
  assigneeTrigger?: string;
};

type IssueLabeledEvent = {
  eventName: "issues";
  eventAction: "labeled";
  isPR: false;
  issueNumber: string;
  baseBranch: string;
  claudeBranch: string;
  labelTrigger: string;
};

type PullRequestBaseEvent = {
  eventAction?: string;
  isPR: true;
  prNumber: string;
  claudeBranch?: string;
  baseBranch?: string;
};

type PullRequestEvent = PullRequestBaseEvent & {
  eventName: "pull_request";
};

type PullRequestTargetEvent = PullRequestBaseEvent & {
  eventName: "pull_request_target";
};

export type EventData =
  | PullRequestReviewCommentEvent
  | PullRequestReviewEvent
  | PullRequestCommentEvent
  | IssueCommentEvent
  | IssueOpenedEvent
  | IssueAssignedEvent
  | IssueLabeledEvent
  | PullRequestEvent
  | PullRequestTargetEvent;

export type PreparedContext = CommonFields & {
  eventData: EventData;
  giteaContext?: GiteaContext;
};
