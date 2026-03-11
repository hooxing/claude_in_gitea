#!/usr/bin/env node
// Gitea Comment MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createGiteaClient } from "../gitea/api/client";
import { updateClaudeComment } from "../gitea/operations/comments/update-claude-comment";
import { sanitizeContent } from "../gitea/utils/sanitizer";

const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;

if (!REPO_OWNER || !REPO_NAME) {
  console.error(
    "Error: REPO_OWNER and REPO_NAME environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "Gitea Comment Server",
  version: "0.0.1",
});

server.tool(
  "update_claude_comment",
  "Update the Claude comment with progress and results",
  {
    body: z.string().describe("The updated comment content"),
  },
  async ({ body }) => {
    try {
      const giteaToken = process.env.GITEA_TOKEN;
      const claudeCommentId = process.env.CLAUDE_COMMENT_ID;

      if (!giteaToken) {
        throw new Error("GITEA_TOKEN environment variable is required");
      }
      if (!claudeCommentId) {
        throw new Error("CLAUDE_COMMENT_ID environment variable is required");
      }

      const owner = REPO_OWNER;
      const repo = REPO_NAME;
      const commentId = parseInt(claudeCommentId, 10);

      const client = createGiteaClient(giteaToken);

      const sanitizedBody = sanitizeContent(body);

      const result = await updateClaudeComment(client, {
        owner,
        repo,
        commentId,
        body: sanitizedBody,
        isPullRequestReviewComment: false,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("exit", () => {
    server.close();
  });
}

runServer().catch(console.error);
