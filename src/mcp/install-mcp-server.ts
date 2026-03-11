import * as core from "../utils/action-io";
import { GITEA_API_URL, GITEA_SERVER_URL } from "../gitea/api/config";
import type { GiteaContext } from "../gitea/context";
import { isEntityContext } from "../gitea/context";
import type { AutoDetectedMode } from "../modes/detector";

type PrepareConfigParams = {
  giteaToken: string;
  owner: string;
  repo: string;
  branch: string;
  baseBranch: string;
  claudeCommentId?: string;
  allowedTools: string[];
  mode: AutoDetectedMode;
  context: GiteaContext;
};

export async function prepareMcpConfig(
  params: PrepareConfigParams,
): Promise<string> {
  const {
    giteaToken,
    owner,
    repo,
    branch,
    baseBranch,
    claudeCommentId,
    allowedTools,
    context,
    mode,
  } = params;

  try {
    const allowedToolsList = allowedTools || [];
    const isAgentMode = mode === "agent";

    const hasGiteaCommentTools = allowedToolsList.some((tool) =>
      tool.startsWith("mcp__gitea_comment__"),
    );
    const hasInlineCommentTools = allowedToolsList.some((tool) =>
      tool.startsWith("mcp__gitea_inline_comment__"),
    );
    const hasGiteaFileOpsTools = allowedToolsList.some((tool) =>
      tool.startsWith("mcp__gitea_file_ops__"),
    );
    const hasGiteaCITools = allowedToolsList.some((tool) =>
      tool.startsWith("mcp__gitea_ci__"),
    );

    const baseMcpConfig: { mcpServers: Record<string, unknown> } = {
      mcpServers: {},
    };

    const shouldIncludeCommentServer = !isAgentMode || hasGiteaCommentTools;
    if (shouldIncludeCommentServer) {
      baseMcpConfig.mcpServers.gitea_comment = {
        command: "bun",
        args: [
          "run",
          `${process.env.GITEA_ACTION_PATH || process.env.GITHUB_ACTION_PATH}/src/mcp/gitea-comment-server.ts`,
        ],
        env: {
          GITEA_TOKEN: giteaToken,
          REPO_OWNER: owner,
          REPO_NAME: repo,
          ...(claudeCommentId && { CLAUDE_COMMENT_ID: claudeCommentId }),
          GITEA_EVENT_NAME: process.env.GITEA_EVENT_NAME || process.env.GITHUB_EVENT_NAME || "",
          GITEA_API_URL: GITEA_API_URL,
        },
      };
    }

    if (context.inputs.useCommitSigning || hasGiteaFileOpsTools) {
      baseMcpConfig.mcpServers.gitea_file_ops = {
        command: "bun",
        args: [
          "run",
          `${process.env.GITEA_ACTION_PATH || process.env.GITHUB_ACTION_PATH}/src/mcp/gitea-file-ops-server.ts`,
        ],
        env: {
          GITEA_TOKEN: giteaToken,
          REPO_OWNER: owner,
          REPO_NAME: repo,
          BRANCH_NAME: branch,
          BASE_BRANCH: baseBranch,
          REPO_DIR: process.env.GITEA_WORKSPACE || process.cwd(),
          GITEA_EVENT_NAME: process.env.GITEA_EVENT_NAME || process.env.GITHUB_EVENT_NAME || "",
          GITEA_API_URL: GITEA_API_URL,
        },
      };
    }

    if (
      isEntityContext(context) &&
      context.isPR &&
      (hasInlineCommentTools || allowedToolsList.some((t) => t.startsWith("mcp__gitea__")))
    ) {
      baseMcpConfig.mcpServers.gitea_inline_comment = {
        command: "bun",
        args: [
          "run",
          `${process.env.GITEA_ACTION_PATH || process.env.GITHUB_ACTION_PATH}/src/mcp/gitea-inline-comment-server.ts`,
        ],
        env: {
          GITEA_TOKEN: giteaToken,
          REPO_OWNER: owner,
          REPO_NAME: repo,
          PR_NUMBER: context.entityNumber?.toString() || "",
          GITEA_API_URL: GITEA_API_URL,
        },
      };
    }

    if (hasGiteaCITools && process.env.ENABLE_GITEA_CI_MCP === "true") {
      baseMcpConfig.mcpServers.gitea_ci = {
        command: "bun",
        args: [
          "run",
          `${process.env.GITEA_ACTION_PATH || process.env.GITHUB_ACTION_PATH}/src/mcp/gitea-actions-server.ts`,
        ],
        env: {
          GITEA_TOKEN: giteaToken,
          REPO_OWNER: owner,
          REPO_NAME: repo,
          PR_NUMBER: context.entityNumber?.toString() || "",
          RUNNER_TEMP: process.env.RUNNER_TEMP || "/tmp",
          GITEA_SERVER_URL: GITEA_SERVER_URL,
        },
      };
    }

    return JSON.stringify(baseMcpConfig, null, 2);
  } catch (error) {
    core.setFailed(`Install MCP server failed with error: ${error}`);
    process.exit(1);
  }
}
