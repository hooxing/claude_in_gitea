#!/usr/bin/env bun

import * as core from "../utils/action-io";
import { setupGiteaToken } from "../gitea/token";
import { checkWritePermissions } from "../gitea/validation/permissions";
import { createGiteaClient } from "../gitea/api/client";
import { parseGiteaContext, isEntityContext } from "../gitea/context";
import { detectMode } from "../modes/detector";
import { prepareTagMode } from "../modes/tag";
import { prepareAgentMode } from "../modes/agent";
import { checkContainsTrigger } from "../gitea/validation/trigger";
import { collectActionInputsPresence } from "./collect-inputs";

async function run() {
  try {
    collectActionInputsPresence();
    const context = parseGiteaContext();
    const modeName = detectMode(context);

    const giteaToken = await setupGiteaToken();
    const client = createGiteaClient(giteaToken);

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

    core.setOutput("contains_trigger", containsTrigger.toString());

    if (!containsTrigger) {
      core.setOutput("gitea_token", giteaToken);
      return;
    }

    if (modeName === "tag") {
      await prepareTagMode({ context, client, giteaToken });
    } else {
      await prepareAgentMode({ context, client, giteaToken });
    }

    core.setOutput("gitea_token", giteaToken);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(`Prepare step failed with error: ${errorMessage}`);
    core.setOutput("prepare_error", errorMessage);
    process.exit(1);
  }
}

if (import.meta.main) {
  run();
}
