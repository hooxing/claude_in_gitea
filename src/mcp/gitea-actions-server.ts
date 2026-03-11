#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const server = new McpServer({
  name: "Gitea CI Server",
  version: "0.0.1",
});

const notSupported = {
  content: [
    {
      type: "text",
      text:
        "Gitea CI MCP server is not implemented. Enable with ENABLE_GITEA_CI_MCP and provide custom implementation.",
    },
  ],
  isError: true,
  error: "Not implemented",
};

server.tool(
  "get_ci_status",
  "Get CI status summary for this PR",
  {
    status: z.string().optional(),
  },
  async () => notSupported,
);

server.tool(
  "get_workflow_run_details",
  "Get job and step details for a workflow run",
  {
    run_id: z.number(),
  },
  async () => notSupported,
);

server.tool(
  "download_job_log",
  "Download job logs to disk",
  {
    job_id: z.number(),
  },
  async () => notSupported,
);

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.on("exit", () => {
    server.close();
  });
}

runServer().catch(() => process.exit(1));
