import { mkdir, writeFile } from "fs/promises";
import { prepareMcpConfig } from "../../mcp/install-mcp-server";
import { parseAllowedTools } from "./parse-tools";
import {
  configureGitAuth,
  setupSshSigning,
} from "../../gitea/operations/git-config";
import { createInitialComment } from "../../gitea/operations/comments/create-initial";
import { checkHumanActor } from "../../gitea/validation/actor";
import { isEntityContext } from "../../gitea/context";
import type { GiteaContext } from "../../gitea/context";
import type { GiteaClient } from "../../gitea/api/client";

export async function prepareAgentMode({
  context,
  client,
  giteaToken,
}: {
  context: GiteaContext;
  client: GiteaClient;
  giteaToken: string;
}) {
  await checkHumanActor(client, context);

  const useSshSigning = !!context.inputs.sshSigningKey;
  const useApiCommitSigning = context.inputs.useCommitSigning && !useSshSigning;

  if (useSshSigning) {
    await setupSshSigning(context.inputs.sshSigningKey);

    const user = {
      login: context.inputs.botName,
      id: parseInt(context.inputs.botId, 10),
    };
    try {
      await configureGitAuth(giteaToken, context, user);
    } catch (error) {
      console.error("Failed to configure git authentication:", error);
    }
  } else if (!useApiCommitSigning) {
    const user = {
      login: context.inputs.botName,
      id: parseInt(context.inputs.botId, 10),
    };
    try {
      await configureGitAuth(giteaToken, context, user);
    } catch (error) {
      console.error("Failed to configure git authentication:", error);
    }
  }

  await mkdir(`${process.env.RUNNER_TEMP || "/tmp"}/claude-prompts`, {
    recursive: true,
  });

  const promptContent =
    context.inputs.prompt ||
    `Repository: ${context.repository.owner}/${context.repository.repo}`;

  await writeFile(
    `${process.env.RUNNER_TEMP || "/tmp"}/claude-prompts/claude-prompt.txt`,
    promptContent,
  );

  const userClaudeArgs = process.env.CLAUDE_ARGS || "";
  const userAllowedTools = parseAllowedTools(userClaudeArgs);

  let commentId: number | undefined;
  if (isEntityContext(context)) {
    const comment = await createInitialComment(client, context);
    commentId = comment?.id;
  }

  const allowedTools = new Set(userAllowedTools);
  if (commentId) {
    allowedTools.add("mcp__gitea_comment__update_claude_comment");
  }

  const claudeBranch = process.env.CLAUDE_BRANCH || undefined;
  const baseBranch =
    process.env.BASE_BRANCH || context.inputs.baseBranch || "main";

  const currentBranch =
    claudeBranch ||
    process.env.GITEA_HEAD_REF ||
    process.env.GITHUB_HEAD_REF ||
    process.env.GITEA_REF_NAME ||
    process.env.GITHUB_REF_NAME ||
    "main";

  const ourMcpConfig = await prepareMcpConfig({
    giteaToken,
    owner: context.repository.owner,
    repo: context.repository.repo,
    branch: currentBranch,
    baseBranch: baseBranch,
    claudeCommentId: commentId ? String(commentId) : undefined,
    allowedTools: Array.from(allowedTools),
    mode: "agent",
    context,
  });

  let claudeArgs = "";
  const ourConfig = JSON.parse(ourMcpConfig);
  if (ourConfig.mcpServers && Object.keys(ourConfig.mcpServers).length > 0) {
    const escapedOurConfig = ourMcpConfig.replace(/'/g, "'\\''");
    claudeArgs = `--mcp-config '${escapedOurConfig}'`;
  }

  const allowedToolsList = Array.from(allowedTools);
  if (allowedToolsList.length > 0) {
    claudeArgs = `${claudeArgs} --allowedTools "${allowedToolsList.join(",")}"`;
  }

  claudeArgs = `${claudeArgs} ${userClaudeArgs}`.trim();

  return {
    commentId,
    branchInfo: {
      baseBranch: baseBranch,
      currentBranch: baseBranch,
      claudeBranch: claudeBranch,
    },
    mcpConfig: ourMcpConfig,
    claudeArgs,
  };
}
