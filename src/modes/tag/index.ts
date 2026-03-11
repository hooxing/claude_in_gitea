import { checkHumanActor } from "../../gitea/validation/actor";
import { createInitialComment } from "../../gitea/operations/comments/create-initial";
import { setupBranch } from "../../gitea/operations/branch";
import {
  configureGitAuth,
  setupSshSigning,
} from "../../gitea/operations/git-config";
import { prepareMcpConfig } from "../../mcp/install-mcp-server";
import {
  fetchGiteaData,
  extractTriggerTimestamp,
  extractOriginalTitle,
  extractOriginalBody,
} from "../../gitea/data/fetcher";
import { createPrompt } from "../../create-prompt";
import { isEntityContext } from "../../gitea/context";
import type { GiteaContext } from "../../gitea/context";
import type { GiteaClient } from "../../gitea/api/client";
import { parseAllowedTools } from "../agent/parse-tools";

export async function prepareTagMode({
  context,
  client,
  giteaToken,
}: {
  context: GiteaContext;
  client: GiteaClient;
  giteaToken: string;
}) {
  if (!isEntityContext(context)) {
    throw new Error("Tag mode requires entity context");
  }

  await checkHumanActor(client, context);

  const commentData = await createInitialComment(client, context);
  const commentId = commentData.id;

  const triggerTime = extractTriggerTimestamp(context);
  const originalTitle = extractOriginalTitle(context);
  const originalBody = extractOriginalBody(context);

  const giteaData = await fetchGiteaData({
    client,
    repository: `${context.repository.owner}/${context.repository.repo}`,
    prNumber: context.entityNumber.toString(),
    isPR: context.isPR,
    triggerUsername: context.actor,
    triggerTime,
    originalTitle,
    originalBody,
    includeCommentsByActor: context.inputs.includeCommentsByActor,
    excludeCommentsByActor: context.inputs.excludeCommentsByActor,
  });

  const branchInfo = await setupBranch(client, giteaData, context);

  const useSshSigning = !!context.inputs.sshSigningKey;
  const useApiCommitSigning = context.inputs.useCommitSigning && !useSshSigning;

  if (useSshSigning) {
    await setupSshSigning(context.inputs.sshSigningKey);
    const user = {
      login: context.inputs.botName,
      id: parseInt(context.inputs.botId, 10),
    };
    await configureGitAuth(giteaToken, context, user);
  } else if (!useApiCommitSigning) {
    const user = {
      login: context.inputs.botName,
      id: parseInt(context.inputs.botId, 10),
    };
    await configureGitAuth(giteaToken, context, user);
  }

  await createPrompt(
    commentId,
    branchInfo.baseBranch,
    branchInfo.claudeBranch,
    giteaData,
    context,
  );

  const userClaudeArgs = process.env.CLAUDE_ARGS || "";
  const userAllowedMCPTools = parseAllowedTools(userClaudeArgs).filter((tool) =>
    tool.startsWith("mcp__gitea_"),
  );

  const tagModeTools = [
    "Edit",
    "MultiEdit",
    "Glob",
    "Grep",
    "LS",
    "Read",
    "Write",
    "mcp__gitea_comment__update_claude_comment",
    "mcp__gitea_ci__get_ci_status",
    "mcp__gitea_ci__get_workflow_run_details",
    "mcp__gitea_ci__download_job_log",
    ...userAllowedMCPTools,
  ];

  if (context.isPR) {
    tagModeTools.push("mcp__gitea_inline_comment__create_inline_comment");
  }

  if (!useApiCommitSigning) {
    tagModeTools.push(
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git push:*)",
      "Bash(git status:*)",
      "Bash(git diff:*)",
      "Bash(git log:*)",
      "Bash(git rm:*)",
    );
  } else {
    tagModeTools.push(
      "mcp__gitea_file_ops__commit_files",
      "mcp__gitea_file_ops__delete_files",
    );
  }

  const ourMcpConfig = await prepareMcpConfig({
    giteaToken,
    owner: context.repository.owner,
    repo: context.repository.repo,
    branch: branchInfo.claudeBranch || branchInfo.currentBranch,
    baseBranch: branchInfo.baseBranch,
    claudeCommentId: commentId.toString(),
    allowedTools: Array.from(new Set(tagModeTools)),
    mode: "tag",
    context,
  });

  let claudeArgs = "";
  const escapedOurConfig = ourMcpConfig.replace(/'/g, "'\\''");
  claudeArgs = `--mcp-config '${escapedOurConfig}'`;

  claudeArgs += ` --allowedTools "${tagModeTools.join(",")}"`;

  if (userClaudeArgs) {
    claudeArgs += ` ${userClaudeArgs}`;
  }

  return {
    commentId,
    branchInfo,
    mcpConfig: ourMcpConfig,
    claudeArgs: claudeArgs.trim(),
  };
}
