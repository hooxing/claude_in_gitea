#!/usr/bin/env bun

import * as core from "../utils/action-io";
import { dirname } from "path";
import { spawn } from "child_process";
import { appendFile } from "fs/promises";
import { existsSync, readFileSync } from "fs";
import { setupGiteaToken } from "../gitea/token";
import { checkWritePermissions } from "../gitea/validation/permissions";
import { createGiteaClient } from "../gitea/api/client";
import type { GiteaClient } from "../gitea/api/client";
import { parseGiteaContext, isEntityContext } from "../gitea/context";
import type { GiteaContext } from "../gitea/context";
import { detectMode } from "../modes/detector";
import { prepareTagMode } from "../modes/tag";
import { prepareAgentMode } from "../modes/agent";
import { checkContainsTrigger } from "../gitea/validation/trigger";
import { collectActionInputsPresence } from "./collect-inputs";
import { updateCommentLink } from "./update-comment-link";
import { formatTurnsFromData } from "./format-turns";
import type { Turn } from "./format-turns";
// Base-action imports
import { validateEnvironmentVariables } from "../../base-action/src/validate-env";
import { setupClaudeCodeSettings } from "../../base-action/src/setup-claude-code-settings";
import { installPlugins } from "../../base-action/src/install-plugins";
import { preparePrompt } from "../../base-action/src/prepare-prompt";
import { runClaude } from "../../base-action/src/run-claude";
import type { ClaudeRunResult } from "../../base-action/src/run-claude-sdk";

async function installClaudeCode(): Promise<void> {
  const customExecutable = process.env.PATH_TO_CLAUDE_CODE_EXECUTABLE;
  if (customExecutable) {
    const claudeDir = dirname(customExecutable);
    const giteaPath = process.env.GITEA_PATH || process.env.GITHUB_PATH;
    if (giteaPath) {
      await appendFile(giteaPath, `${claudeDir}\n`);
    }
    process.env.PATH = `${claudeDir}:${process.env.PATH}`;
    return;
  }

  const claudeCodeVersion = "2.1.72";

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const child = spawn(
          "bash",
          [
            "-c",
            `curl -fsSL https://claude.ai/install.sh | bash -s -- ${claudeCodeVersion}`,
          ],
          { stdio: "inherit" },
        );
        child.on("close", (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Install failed with exit code ${code}`));
        });
        child.on("error", reject);
      });

      const homeBin = `${process.env.HOME}/.local/bin`;
      const giteaPath = process.env.GITEA_PATH || process.env.GITHUB_PATH;
      if (giteaPath) {
        await appendFile(giteaPath, `${homeBin}\n`);
      }
      process.env.PATH = `${homeBin}:${process.env.PATH}`;
      return;
    } catch (error) {
      if (attempt === 3) {
        throw new Error(`Failed to install Claude Code after 3 attempts: ${error}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}

async function writeStepSummary(executionFile: string): Promise<void> {
  const summaryFile = process.env.GITEA_STEP_SUMMARY || process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  try {
    const fileContent = readFileSync(executionFile, "utf-8");
    const data: Turn[] = JSON.parse(fileContent);
    const markdown = formatTurnsFromData(data);
    await appendFile(summaryFile, markdown);
  } catch {
    // ignore summary failures
  }
}

async function run() {
  let giteaToken: string | undefined;
  let commentId: number | undefined;
  let claudeBranch: string | undefined;
  let baseBranch: string | undefined;
  let executionFile: string | undefined;
  let claudeSuccess = false;
  let prepareSuccess = true;
  let prepareError: string | undefined;
  let context: GiteaContext | undefined;
  let client: GiteaClient | undefined;
  let prepareCompleted = false;

  try {
    const actionInputsPresent = collectActionInputsPresence();
    context = parseGiteaContext();
    const modeName = detectMode(context);

    giteaToken = await setupGiteaToken();
    client = createGiteaClient(giteaToken);

    process.env.GITEA_TOKEN = giteaToken;

    if (isEntityContext(context)) {
      const tokenProvided = !!process.env.OVERRIDE_GITEA_TOKEN;
      const hasWritePermissions = await checkWritePermissions(
        client,
        context,
        context.inputs.allowedNonWriteUsers,
        tokenProvided,
      );
      if (!hasWritePermissions) {
        throw new Error("Actor does not have write permissions to the repository");
      }
    }

    const containsTrigger =
      modeName === "tag"
        ? isEntityContext(context) && checkContainsTrigger(context)
        : !!context.inputs?.prompt;

    if (!containsTrigger) {
      core.setOutput("gitea_token", giteaToken);
      return;
    }

    const prepareResult =
      modeName === "tag"
        ? await prepareTagMode({ context, client, giteaToken })
        : await prepareAgentMode({ context, client, giteaToken });

    commentId = prepareResult.commentId;
    claudeBranch = prepareResult.branchInfo.claudeBranch;
    baseBranch = prepareResult.branchInfo.baseBranch;
    prepareCompleted = true;

    await installClaudeCode();

    process.env.INPUT_ACTION_INPUTS_PRESENT = actionInputsPresent;
    process.env.CLAUDE_CODE_ACTION = "1";
    process.env.DETAILED_PERMISSION_MESSAGES = "1";

    validateEnvironmentVariables();

    await setupClaudeCodeSettings(process.env.INPUT_SETTINGS);

    await installPlugins(
      process.env.INPUT_PLUGIN_MARKETPLACES,
      process.env.INPUT_PLUGINS,
      process.env.INPUT_PATH_TO_CLAUDE_CODE_EXECUTABLE,
    );

    const promptFile =
      process.env.INPUT_PROMPT_FILE ||
      `${process.env.RUNNER_TEMP}/claude-prompts/claude-prompt.txt`;
    const promptConfig = await preparePrompt({ prompt: "", promptFile });

    const claudeResult: ClaudeRunResult = await runClaude(promptConfig.path, {
      claudeArgs: prepareResult.claudeArgs,
      appendSystemPrompt: process.env.APPEND_SYSTEM_PROMPT,
      model: process.env.ANTHROPIC_MODEL,
      pathToClaudeCodeExecutable: process.env.INPUT_PATH_TO_CLAUDE_CODE_EXECUTABLE,
      showFullOutput: process.env.INPUT_SHOW_FULL_OUTPUT,
    });

    claudeSuccess = claudeResult.conclusion === "success";
    executionFile = claudeResult.executionFile;

    if (claudeResult.executionFile) {
      core.setOutput("execution_file", claudeResult.executionFile);
    }
    if (claudeResult.sessionId) {
      core.setOutput("session_id", claudeResult.sessionId);
    }
    if (claudeResult.structuredOutput) {
      core.setOutput("structured_output", claudeResult.structuredOutput);
    }
    core.setOutput("conclusion", claudeResult.conclusion);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (!prepareCompleted) {
      prepareSuccess = false;
      prepareError = errorMessage;
    }
    core.setFailed(`Action failed with error: ${errorMessage}`);
  } finally {
    if (
      commentId &&
      context &&
      isEntityContext(context) &&
      giteaToken &&
      client
    ) {
      try {
        await updateCommentLink({
          commentId,
          giteaToken,
          claudeBranch,
          baseBranch: baseBranch || "main",
          triggerUsername: context.actor,
          context,
          client,
          claudeSuccess,
          outputFile: executionFile,
          prepareSuccess,
          prepareError,
          useCommitSigning: context.inputs.useCommitSigning,
        });
      } catch (error) {
        console.error("Error updating comment with job link:", error);
      }
    }

    if (
      executionFile &&
      existsSync(executionFile) &&
      process.env.DISPLAY_REPORT !== "false"
    ) {
      await writeStepSummary(executionFile);
    }

    core.setOutput("branch_name", claudeBranch || "");
    if (giteaToken) {
      core.setOutput("gitea_token", giteaToken);
    }
  }
}

if (import.meta.main) {
  run();
}
