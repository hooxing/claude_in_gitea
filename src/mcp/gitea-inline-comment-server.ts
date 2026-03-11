#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createGiteaClient } from "../gitea/api/client";
import { sanitizeContent } from "../gitea/utils/sanitizer";
import { findDiffPosition } from "../gitea/utils/diff-position";

const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const PR_NUMBER = process.env.PR_NUMBER;

if (!REPO_OWNER || !REPO_NAME || !PR_NUMBER) {
  console.error(
    "Error: REPO_OWNER, REPO_NAME, and PR_NUMBER environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "Gitea Inline Comment Server",
  version: "0.0.1",
});

server.tool(
  "create_inline_comment",
  "Create an inline comment on a specific diff position in a PR file",
  z
    .object({
      path: z.string().describe("File path to comment on"),
      body: z.string().describe("Comment text (markdown supported)"),
      position: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("Diff position (Gitea uses position, not line numbers)"),
      line: z
        .number()
        .int()
        .positive()
        .optional()
        .describe("Line number in the file (1-based)"),
      side: z
        .enum(["LEFT", "RIGHT"])
        .optional()
        .describe("Diff side for line-based comments"),
      commit_id: z.string().optional().describe("Commit SHA to comment on"),
    })
    .refine((data) => data.position !== undefined || data.line !== undefined, {
      message: "Either position or line must be provided",
    }),
  async ({ path, body, position, line, side, commit_id }) => {
    try {
      const giteaToken = process.env.GITEA_TOKEN;
      if (!giteaToken) {
        throw new Error("GITEA_TOKEN environment variable is required");
      }

      const client = createGiteaClient(giteaToken);
      const pull_number = parseInt(PR_NUMBER, 10);
      const sanitizedBody = sanitizeContent(body);
      const commentSide = side ?? "RIGHT";
      let diffPosition = position;

      if (diffPosition === undefined) {
        if (!line) {
          throw new Error("line is required when position is not provided");
        }

        const diffText = await client.request<string>({
          method: "GET",
          path: `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}.diff`,
          rawResponse: true,
          headers: {
            Accept: "text/plain",
          },
        });

        diffPosition = findDiffPosition(diffText, path, line, commentSide);

        if (diffPosition === null) {
          throw new Error(
            `Unable to map ${path}:${line} (${commentSide}) to a diff position`,
          );
        }
      }

      const commentPayload =
        commentSide === "LEFT"
          ? { path, body: sanitizedBody, old_position: diffPosition }
          : { path, body: sanitizedBody, new_position: diffPosition };

      const reviewPayload = {
        body: "",
        event: "COMMENT",
        commit_id,
        comments: [commentPayload],
      };

      const result = await client.post<any>(
        `/repos/${REPO_OWNER}/${REPO_NAME}/pulls/${pull_number}/reviews`,
        reviewPayload,
      );

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                review_id: result.id,
                message: `Inline comment created on ${path} at position ${diffPosition}`,
              },
              null,
              2,
            ),
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
            text: `Error creating inline comment: ${errorMessage}`,
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
