import type {
  ParsedGiteaContext,
  AutomationContext,
  RepositoryDispatchEvent,
} from "../src/gitea/context";
import { CLAUDE_APP_BOT_ID, CLAUDE_BOT_LOGIN } from "../src/gitea/constants";

const defaultInputs = {
  prompt: "",
  triggerPhrase: "/claude",
  assigneeTrigger: "",
  labelTrigger: "",
  baseBranch: "main",
  branchPrefix: "claude/",
  branchNameTemplate: "",
  useStickyComment: false,
  useCommitSigning: false,
  sshSigningKey: "",
  botId: String(CLAUDE_APP_BOT_ID),
  botName: CLAUDE_BOT_LOGIN,
  allowedBots: "",
  allowedNonWriteUsers: "",
  trackProgress: false,
  includeFixLinks: true,
  includeCommentsByActor: "",
  excludeCommentsByActor: "",
};

const defaultRepository = {
  owner: "test-owner",
  repo: "test-repo",
  full_name: "test-owner/test-repo",
};

type MockContextOverrides = Omit<Partial<ParsedGiteaContext>, "inputs"> & {
  inputs?: Partial<ParsedGiteaContext["inputs"]>;
};

export const createMockContext = (
  overrides: MockContextOverrides = {},
): ParsedGiteaContext => {
  const baseContext: ParsedGiteaContext = {
    runId: "1234567890",
    eventName: "issue_comment",
    eventAction: "",
    repository: defaultRepository,
    actor: "test-actor",
    payload: {} as any,
    entityNumber: 1,
    isPR: false,
    inputs: defaultInputs,
  };

  const mergedInputs = overrides.inputs
    ? {
        ...defaultInputs,
        ...overrides.inputs,
        includeCommentsByActor: overrides.inputs.includeCommentsByActor ?? "",
        excludeCommentsByActor: overrides.inputs.excludeCommentsByActor ?? "",
      }
    : defaultInputs;

  return { ...baseContext, ...overrides, inputs: mergedInputs };
};

type MockAutomationOverrides = Omit<Partial<AutomationContext>, "inputs"> & {
  inputs?: Partial<AutomationContext["inputs"]>;
};

export const createMockAutomationContext = (
  overrides: MockAutomationOverrides = {},
): AutomationContext => {
  const baseContext: AutomationContext = {
    runId: "1234567890",
    eventName: "workflow_dispatch",
    eventAction: undefined,
    repository: defaultRepository,
    actor: "test-actor",
    payload: {} as any,
    inputs: defaultInputs,
  };

  const mergedInputs = overrides.inputs
    ? {
        ...defaultInputs,
        ...overrides.inputs,
        includeCommentsByActor: overrides.inputs.includeCommentsByActor ?? "",
        excludeCommentsByActor: overrides.inputs.excludeCommentsByActor ?? "",
      }
    : { ...defaultInputs };

  return { ...baseContext, ...overrides, inputs: mergedInputs };
};

export const mockRepositoryDispatchContext: AutomationContext = {
  runId: "1234567890",
  eventName: "repository_dispatch",
  eventAction: undefined,
  repository: defaultRepository,
  actor: "automation-user",
  payload: {
    action: "trigger-analysis",
    client_payload: {
      source: "issue-detective",
      issue_number: 42,
      repository_name: "test-owner/test-repo",
      analysis_type: "bug-report",
    },
    repository: {
      name: "test-repo",
      owner: {
        login: "test-owner",
      },
    },
    sender: {
      login: "automation-user",
    },
  } as RepositoryDispatchEvent,
  inputs: defaultInputs,
};

export const mockIssueOpenedContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "issues",
  eventAction: "opened",
  repository: defaultRepository,
  actor: "john-doe",
  payload: {
    action: "opened",
    issue: {
      number: 42,
      title: "Bug: Application crashes on startup",
      body: "## Description\n\nThe application crashes immediately after launching.\n\n## Steps to reproduce\n\n1. Install the app\n2. Launch it\n3. See crash\n\n/claude please help me fix this",
      assignee: null,
      user: {
        login: "john-doe",
      },
      pull_request: null,
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
  },
  entityNumber: 42,
  isPR: false,
  inputs: defaultInputs,
};

export const mockIssueAssignedContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "issues",
  eventAction: "assigned",
  repository: defaultRepository,
  actor: "admin-user",
  payload: {
    action: "assigned",
    issue: {
      number: 123,
      title: "Feature: Add dark mode support",
      body: "We need dark mode for better user experience",
      user: {
        login: "jane-smith",
      },
      assignee: {
        login: "claude-bot",
      },
      pull_request: null,
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
  },
  entityNumber: 123,
  isPR: false,
  inputs: { ...defaultInputs, assigneeTrigger: "@claude-bot" },
};

export const mockIssueLabeledContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "issues",
  eventAction: "labeled",
  repository: defaultRepository,
  actor: "admin-user",
  payload: {
    action: "labeled",
    issue: {
      number: 1234,
      title: "Enhancement: Improve search functionality",
      body: "The current search is too slow and needs optimization",
      user: {
        login: "alice-wonder",
      },
      assignee: null,
      pull_request: null,
    },
    label: {
      name: "claude-task",
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
  },
  entityNumber: 1234,
  isPR: false,
  inputs: { ...defaultInputs, labelTrigger: "claude-task" },
};

export const mockIssueCommentContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "issue_comment",
  eventAction: "created",
  repository: defaultRepository,
  actor: "contributor-user",
  payload: {
    action: "created",
    comment: {
      id: 12345678,
      body: "@claude can you help explain how to configure the logging system?",
      user: {
        login: "contributor-user",
      },
      created_at: "2024-01-15T12:30:00Z",
      updated_at: "2024-01-15T12:30:00Z",
    },
    issue: {
      number: 55,
      title: "Question about logging",
      body: "How do I configure logging?",
      user: {
        login: "contributor-user",
      },
      pull_request: null,
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
  },
  entityNumber: 55,
  isPR: false,
  inputs: { ...defaultInputs, triggerPhrase: "@claude" },
};

export const mockPullRequestCommentContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "issue_comment",
  eventAction: "created",
  repository: defaultRepository,
  actor: "reviewer-user",
  payload: {
    action: "created",
    issue: {
      number: 789,
      title: "Fix: Memory leak in user service",
      body: "This PR fixes the memory leak issue reported in #788",
      user: {
        login: "developer-user",
      },
      pull_request: {},
    },
    comment: {
      id: 87654321,
      body: "/claude please review the changes and ensure we're not introducing any new memory issues",
      user: {
        login: "reviewer-user",
      },
      created_at: "2024-01-15T13:15:00Z",
      updated_at: "2024-01-15T13:15:00Z",
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
  },
  entityNumber: 789,
  isPR: true,
  inputs: defaultInputs,
};

export const mockPullRequestOpenedContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "pull_request",
  eventAction: "opened",
  repository: defaultRepository,
  actor: "feature-developer",
  payload: {
    action: "opened",
    number: 456,
    pull_request: {
      number: 456,
      title: "Feature: Add user authentication",
      body: "## Summary\n\nThis PR adds JWT-based authentication to the API.\n\n## Changes\n\n- Added auth middleware\n- Added login endpoint\n- Added JWT token generation\n\n/claude please review the security aspects",
      user: {
        login: "feature-developer",
      },
      head: {
        ref: "feature/auth",
        sha: "abc123",
        repo: { full_name: "test-owner/test-repo" },
      },
      base: {
        ref: "main",
        sha: "def456",
        repo: { full_name: "test-owner/test-repo" },
      },
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
  },
  entityNumber: 456,
  isPR: true,
  inputs: defaultInputs,
};

export const mockPullRequestReviewContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "pull_request_approved",
  eventAction: "reviewed",
  repository: defaultRepository,
  actor: "senior-developer",
  payload: {
    action: "reviewed",
    number: 321,
    review: {
      type: "pull_request_review_approved",
      content:
        "@claude can you check if the error handling is comprehensive enough in this PR?",
    },
    pull_request: {
      number: 321,
      title: "Refactor: Improve error handling in API layer",
      body: "This PR improves error handling across all API endpoints",
      user: {
        login: "backend-developer",
      },
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
    sender: {
      login: "senior-developer",
    },
  },
  entityNumber: 321,
  isPR: true,
  inputs: { ...defaultInputs, triggerPhrase: "@claude" },
};

export const mockPullRequestReviewWithoutCommentContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "pull_request_approved",
  eventAction: "reviewed",
  repository: defaultRepository,
  actor: "senior-developer",
  payload: {
    action: "reviewed",
    number: 321,
    review: {
      type: "pull_request_review_approved",
      content: "",
    },
    pull_request: {
      number: 321,
      title: "Refactor: Improve error handling in API layer",
      body: "This PR improves error handling across all API endpoints",
      user: {
        login: "backend-developer",
      },
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
    sender: {
      login: "senior-developer",
    },
  },
  entityNumber: 321,
  isPR: true,
  inputs: { ...defaultInputs, triggerPhrase: "@claude" },
};

export const mockPullRequestReviewCommentContext: ParsedGiteaContext = {
  runId: "1234567890",
  eventName: "pull_request_comment",
  eventAction: "reviewed",
  repository: defaultRepository,
  actor: "code-reviewer",
  payload: {
    action: "reviewed",
    number: 999,
    commit_id: "",
    review: {
      type: "pull_request_review_comment",
      content: "/claude is this the most efficient way to implement this algorithm?",
    },
    pull_request: {
      number: 999,
      title: "Performance: Optimize search algorithm",
      body: "This PR optimizes the search algorithm for better performance",
      user: {
        login: "performance-dev",
      },
    },
    repository: {
      name: "test-repo",
      full_name: "test-owner/test-repo",
      owner: {
        login: "test-owner",
      },
    },
    sender: {
      login: "code-reviewer",
    },
  },
  entityNumber: 999,
  isPR: true,
  inputs: defaultInputs,
};
