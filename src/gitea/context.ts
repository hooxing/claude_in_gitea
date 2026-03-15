import { readFileSync } from "fs";
import { CLAUDE_APP_BOT_ID, CLAUDE_BOT_LOGIN } from "./constants";
import { validateActionInputs } from "./validation/inputs";

// Custom types for automation-like events
export type WorkflowDispatchEvent = {
  action?: never;
  inputs?: Record<string, any>;
  ref?: string;
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
  workflow: string;
};

export type RepositoryDispatchEvent = {
  action: string;
  client_payload?: Record<string, any>;
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
};

export type ScheduleEvent = {
  action?: never;
  schedule?: string;
  repository: {
    name: string;
    owner: {
      login: string;
    };
  };
};

// Minimal Gitea webhook payload shapes
export type GiteaIssuePayload = {
  action: string;
  issue: {
    number: number;
    title?: string;
    body?: string;
    user?: { login: string };
    assignee?: { login: string } | null;
    pull_request?: Record<string, any> | null;
  };
  label?: { name?: string };
  repository: {
    name: string;
    full_name?: string;
    owner: { login: string };
  };
  sender?: { login: string };
};

export type GiteaIssueCommentPayload = {
  action: string;
  comment: {
    id: number;
    body: string;
    user: { login: string };
    created_at?: string;
    updated_at?: string;
  };
  issue: {
    number: number;
    title?: string;
    body?: string;
    user?: { login: string };
    pull_request?: Record<string, any> | null;
  };
  repository: {
    name: string;
    full_name?: string;
    owner: { login: string };
  };
  sender?: { login: string };
};

export type GiteaPullRequestPayload = {
  action: string;
  number: number;
  pull_request: {
    number: number;
    title?: string;
    body?: string;
    user?: { login: string };
    head: { ref: string; sha?: string; repo?: { full_name?: string } };
    base: { ref: string; sha?: string; repo?: { full_name?: string } };
  };
  repository: {
    name: string;
    full_name?: string;
    owner: { login: string };
  };
  sender?: { login: string };
};

type GiteaReviewPayload = {
  id?: number;
  body?: string | null;
  user?: { login: string };
  state?: string;
  submitted_at?: string;
  type?: string;
  content?: string;
};

export type GiteaPullRequestReviewPayload = {
  action: string;
  review: GiteaReviewPayload;
  pull_request: {
    number: number;
    title?: string;
    body?: string;
    user?: { login: string };
  };
  repository: {
    name: string;
    full_name?: string;
    owner: { login: string };
  };
  sender?: { login: string };
};

export type GiteaPullRequestReviewCommentPayload = {
  action: string;
  comment?: {
    id: number;
    body: string;
    user: { login: string };
    path?: string;
    position?: number;
    created_at?: string;
    updated_at?: string;
  };
  review?: GiteaReviewPayload;
  pull_request: {
    number: number;
    title?: string;
    body?: string;
    user?: { login: string };
  };
  repository: {
    name: string;
    full_name?: string;
    owner: { login: string };
  };
  sender?: { login: string };
};

const ENTITY_EVENT_NAMES = [
  "issues",
  "issue_comment",
  "pull_request",
  "pull_request_review",
  "pull_request_review_comment",
  "pull_request_approved",
  "pull_request_comment",
] as const;

const AUTOMATION_EVENT_NAMES = [
  "workflow_dispatch",
  "repository_dispatch",
  "schedule",
  "workflow_run",
] as const;

type EntityEventName = (typeof ENTITY_EVENT_NAMES)[number];
type AutomationEventName = (typeof AUTOMATION_EVENT_NAMES)[number];

// Common fields shared by all context types
export type BaseContext = {
  runId: string;
  eventAction?: string;
  repository: {
    owner: string;
    repo: string;
    full_name: string;
  };
  actor: string;
  inputs: {
    prompt: string;
    triggerPhrase: string;
    assigneeTrigger: string;
    labelTrigger: string;
    baseBranch?: string;
    branchPrefix: string;
    branchNameTemplate?: string;
    useStickyComment: boolean;
    useCommitSigning: boolean;
    sshSigningKey: string;
    botId: string;
    botName: string;
    allowedBots: string;
    allowedNonWriteUsers: string;
    trackProgress: boolean;
    includeFixLinks: boolean;
    includeCommentsByActor: string;
    excludeCommentsByActor: string;
  };
};

export type ParsedGiteaContext = BaseContext & {
  eventName: EntityEventName;
  payload:
    | GiteaIssuePayload
    | GiteaIssueCommentPayload
    | GiteaPullRequestPayload
    | GiteaPullRequestReviewPayload
    | GiteaPullRequestReviewCommentPayload;
  entityNumber: number;
  isPR: boolean;
};

export type AutomationContext = BaseContext & {
  eventName: AutomationEventName;
  payload:
    | WorkflowDispatchEvent
    | RepositoryDispatchEvent
    | ScheduleEvent
    | Record<string, any>;
};

export type GiteaContext = ParsedGiteaContext | AutomationContext;

function readEventPayload(): any {
  const eventPath =
    process.env.GITEA_EVENT_PATH || process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    return {};
  }
  try {
    const raw = readFileSync(eventPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function resolveRepository(payload: any): {
  owner: string;
  repo: string;
  full_name: string;
} {
  const owner =
    payload?.repository?.owner?.login ||
    payload?.repository?.owner?.username ||
    payload?.repository?.owner?.name ||
    undefined;
  const repo = payload?.repository?.name || undefined;

  if (owner && repo) {
    return {
      owner,
      repo,
      full_name: payload?.repository?.full_name || `${owner}/${repo}`,
    };
  }

  const envRepo =
    process.env.GITEA_REPOSITORY || process.env.GITHUB_REPOSITORY || "";
  const [envOwner, envRepoName] = envRepo.split("/");
  return {
    owner: envOwner || "",
    repo: envRepoName || "",
    full_name: envRepo || "",
  };
}

export function parseGiteaContext(): GiteaContext {
  const payload = readEventPayload();
  const eventName =
    (process.env.GITEA_EVENT_NAME ||
      process.env.GITHUB_EVENT_NAME ||
      "") as EntityEventName | AutomationEventName;

  const repository = resolveRepository(payload);
  const actor =
    payload?.sender?.login ||
    process.env.GITEA_ACTOR ||
    process.env.GITHUB_ACTOR ||
    "";

  const rawInputs = {
    prompt: process.env.PROMPT || "",
    triggerPhrase: process.env.TRIGGER_PHRASE ?? "@claude",
    assigneeTrigger: process.env.ASSIGNEE_TRIGGER ?? "",
    labelTrigger: process.env.LABEL_TRIGGER ?? "",
    baseBranch: process.env.BASE_BRANCH,
    branchPrefix: process.env.BRANCH_PREFIX ?? "claude/",
    branchNameTemplate: process.env.BRANCH_NAME_TEMPLATE,
    useStickyComment: process.env.USE_STICKY_COMMENT === "true",
    useCommitSigning: process.env.USE_COMMIT_SIGNING === "true",
    sshSigningKey: process.env.SSH_SIGNING_KEY || "",
    botId: process.env.BOT_ID ?? String(CLAUDE_APP_BOT_ID),
    botName: process.env.BOT_NAME ?? CLAUDE_BOT_LOGIN,
    allowedBots: process.env.ALLOWED_BOTS ?? "",
    allowedNonWriteUsers: process.env.ALLOWED_NON_WRITE_USERS ?? "",
    trackProgress: process.env.TRACK_PROGRESS === "true",
    includeFixLinks: process.env.INCLUDE_FIX_LINKS === "true",
    includeCommentsByActor: process.env.INCLUDE_COMMENTS_BY_ACTOR ?? "",
    excludeCommentsByActor: process.env.EXCLUDE_COMMENTS_BY_ACTOR ?? "",
  };

  const validatedInputs = validateActionInputs(rawInputs);

  const commonFields: BaseContext = {
    runId:
      process.env.GITEA_RUN_ID || process.env.GITHUB_RUN_ID || "unknown",
    eventAction: payload?.action,
    repository,
    actor,
    inputs: validatedInputs,
  };

  switch (eventName) {
    case "issues": {
      const p = payload as GiteaIssuePayload;
      return {
        ...commonFields,
        eventName: "issues",
        payload: p,
        entityNumber: p.issue?.number ?? 0,
        isPR: Boolean(p.issue?.pull_request),
      };
    }
    case "issue_comment": {
      const p = payload as GiteaIssueCommentPayload;
      return {
        ...commonFields,
        eventName: "issue_comment",
        payload: p,
        entityNumber: p.issue?.number ?? 0,
        isPR: Boolean(p.issue?.pull_request),
      };
    }
    case "pull_request": {
      const p = payload as GiteaPullRequestPayload;
      return {
        ...commonFields,
        eventName: "pull_request",
        payload: p,
        entityNumber: p.pull_request?.number ?? p.number ?? 0,
        isPR: true,
      };
    }
    case "pull_request_review": {
      const p = payload as GiteaPullRequestReviewPayload;
      return {
        ...commonFields,
        eventName: "pull_request_review",
        payload: p,
        entityNumber: p.pull_request?.number ?? 0,
        isPR: true,
      };
    }
    case "pull_request_review_comment": {
      const p = payload as GiteaPullRequestReviewCommentPayload;
      return {
        ...commonFields,
        eventName: "pull_request_review_comment",
        payload: p,
        entityNumber: p.pull_request?.number ?? 0,
        isPR: true,
      };
    }
    case "pull_request_approved": {
      const p = payload as GiteaPullRequestReviewPayload;
      return {
        ...commonFields,
        eventName: "pull_request_approved",
        payload: p,
        entityNumber: p.pull_request?.number ?? p.number ?? 0,
        isPR: true,
      };
    }
    case "pull_request_comment": {
      const p = payload as GiteaPullRequestReviewCommentPayload;
      return {
        ...commonFields,
        eventName: "pull_request_comment",
        payload: p,
        entityNumber: p.pull_request?.number ?? p.number ?? 0,
        isPR: true,
      };
    }
    case "workflow_dispatch":
    case "repository_dispatch":
    case "schedule":
    case "workflow_run": {
      return {
        ...commonFields,
        eventName: eventName as AutomationEventName,
        payload: payload as any,
      };
    }
    default:
      throw new Error(`Unsupported event type: ${eventName}`);
  }
}

export function isIssuesEvent(
  context: GiteaContext,
): context is ParsedGiteaContext & { payload: GiteaIssuePayload } {
  return context.eventName === "issues";
}

export function isIssueCommentEvent(
  context: GiteaContext,
): context is ParsedGiteaContext & { payload: GiteaIssueCommentPayload } {
  return context.eventName === "issue_comment";
}

export function isPullRequestEvent(
  context: GiteaContext,
): context is ParsedGiteaContext & { payload: GiteaPullRequestPayload } {
  return context.eventName === "pull_request";
}

export function isPullRequestReviewEvent(
  context: GiteaContext,
): context is ParsedGiteaContext & { payload: GiteaPullRequestReviewPayload } {
  return (
    context.eventName === "pull_request_review" ||
    context.eventName === "pull_request_approved"
  );
}

export function isPullRequestReviewCommentEvent(
  context: GiteaContext,
): context is ParsedGiteaContext & {
    payload: GiteaPullRequestReviewCommentPayload;
  } {
  return (
    context.eventName === "pull_request_review_comment" ||
    context.eventName === "pull_request_comment"
  );
}

export function isIssuesAssignedEvent(
  context: GiteaContext,
): context is ParsedGiteaContext & { payload: GiteaIssuePayload } {
  return isIssuesEvent(context) && context.eventAction === "assigned";
}

export function isEntityContext(
  context: GiteaContext,
): context is ParsedGiteaContext {
  return ENTITY_EVENT_NAMES.includes(context.eventName as EntityEventName);
}

export function isAutomationContext(
  context: GiteaContext,
): context is AutomationContext {
  return AUTOMATION_EVENT_NAMES.includes(
    context.eventName as AutomationEventName,
  );
}
