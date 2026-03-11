#!/usr/bin/env bun

export class WorkflowValidationSkipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkflowValidationSkipError";
  }
}

/**
 * Gitea authentication: use provided token only.
 * Priority: OVERRIDE_GITEA_TOKEN > GITEA_TOKEN > GITEA_API_TOKEN
 */
export async function setupGiteaToken(): Promise<string> {
  const providedToken =
    process.env.OVERRIDE_GITEA_TOKEN ||
    process.env.GITEA_TOKEN ||
    process.env.GITEA_API_TOKEN ||
    "";

  if (!providedToken) {
    throw new Error(
      "Gitea token not found. Please set gitea_token input or GITEA_TOKEN env.",
    );
  }

  return providedToken;
}
