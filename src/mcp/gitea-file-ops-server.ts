#!/usr/bin/env node
// Gitea File Operations MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { readFile } from "fs/promises";
import { resolve } from "path";
import { createGiteaClient } from "../gitea/api/client";
import { validatePathWithinRepo } from "./path-validation";

const REPO_OWNER = process.env.REPO_OWNER;
const REPO_NAME = process.env.REPO_NAME;
const BRANCH_NAME = process.env.BRANCH_NAME;
const BASE_BRANCH = process.env.BASE_BRANCH;
const REPO_DIR = process.env.REPO_DIR || process.cwd();

if (!REPO_OWNER || !REPO_NAME || !BRANCH_NAME) {
  console.error(
    "Error: REPO_OWNER, REPO_NAME, and BRANCH_NAME environment variables are required",
  );
  process.exit(1);
}

const server = new McpServer({
  name: "Gitea File Operations Server",
  version: "0.0.1",
});

function encodePath(path: string): string {
  return path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function getFileSha(
  client: ReturnType<typeof createGiteaClient>,
  owner: string,
  repo: string,
  path: string,
  branch: string,
): Promise<string | undefined> {
  try {
    const data = await client.get<{ sha?: string }>(
      `/repos/${owner}/${repo}/contents/${encodePath(path)}`,
      { ref: branch },
    );
    return data.sha;
  } catch (error) {
    if (String(error).includes("404")) {
      return undefined;
    }
    throw error;
  }
}

server.tool(
  "commit_files",
  "Commit one or more files to a repository (non-atomic in Gitea REST API)",
  {
    files: z
      .array(z.string())
      .describe('Array of file paths relative to repository root (e.g. ["src/main.js", "README.md"])'),
    message: z.string().describe("Commit message"),
  },
  async ({ files, message }) => {
    try {
      const giteaToken = process.env.GITEA_TOKEN;
      if (!giteaToken) {
        throw new Error("GITEA_TOKEN environment variable is required");
      }

      const client = createGiteaClient(giteaToken);
      const resolvedRepoDir = resolve(REPO_DIR);

      for (const filePath of files) {
        const fullPath = await validatePathWithinRepo(filePath, REPO_DIR);
        const normalizedPath = resolve(resolvedRepoDir, filePath);
        const relativePath = normalizedPath.slice(resolvedRepoDir.length + 1);

        const content = await readFile(fullPath);
        const base64Content = content.toString("base64");

        const sha = await getFileSha(client, REPO_OWNER, REPO_NAME, relativePath, BRANCH_NAME);

        if (sha) {
          await client.put(
            `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(relativePath)}`,
            {
              message,
              content: base64Content,
              sha,
              branch: BRANCH_NAME,
            },
          );
        } else {
          const payload: Record<string, any> = {
            message,
            content: base64Content,
            branch: BRANCH_NAME,
          };
          if (BASE_BRANCH && BASE_BRANCH !== BRANCH_NAME) {
            payload.branch = BASE_BRANCH;
            payload.new_branch = BRANCH_NAME;
          }
          await client.post(
            `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(relativePath)}`,
            payload,
          );
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                files: files.map((path) => ({ path })),
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
            text: `Error: ${errorMessage}`,
          },
        ],
        error: errorMessage,
        isError: true,
      };
    }
  },
);

server.tool(
  "delete_files",
  "Delete one or more files from a repository (non-atomic in Gitea REST API)",
  {
    paths: z
      .array(z.string())
      .describe('Array of file paths to delete relative to repository root (e.g. ["src/old-file.js"])'),
    message: z.string().describe("Commit message"),
  },
  async ({ paths, message }) => {
    try {
      const giteaToken = process.env.GITEA_TOKEN;
      if (!giteaToken) {
        throw new Error("GITEA_TOKEN environment variable is required");
      }

      const client = createGiteaClient(giteaToken);

      for (const path of paths) {
        const sha = await getFileSha(client, REPO_OWNER, REPO_NAME, path, BRANCH_NAME);
        if (!sha) {
          throw new Error(`File not found: ${path}`);
        }

        await client.delete(
          `/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodePath(path)}`,
          { message, sha, branch: BRANCH_NAME },
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                deletedFiles: paths.map((path) => ({ path })),
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
