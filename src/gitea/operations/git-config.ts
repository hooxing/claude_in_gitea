#!/usr/bin/env bun

/**
 * Configure git authentication for non-signing mode (Gitea)
 */

import { $ } from "bun";
import { mkdir, writeFile, rm } from "fs/promises";
import { join } from "path";
import { homedir } from "os";
import type { GiteaContext } from "../context";
import { GITEA_SERVER_URL } from "../api/config";
import * as core from "../../utils/action-io";

const SSH_SIGNING_KEY_PATH = join(homedir(), ".ssh", "claude_signing_key");

type GitUser = {
  login: string;
  id: number;
};

export async function configureGitAuth(
  giteaToken: string,
  context: GiteaContext,
  user: GitUser,
) {
  core.info("Configuring git authentication for Gitea...");

  const serverUrl = new URL(GITEA_SERVER_URL);
  const noreplyDomain = serverUrl.hostname;

  const botName = user.login;
  const botId = user.id;
  await $`git config user.name "${botName}"`;
  await $`git config user.email "${botId}+${botName}@${noreplyDomain}"`;

  // Remove existing auth headers if present
  try {
    await $`git config --unset-all http.${GITEA_SERVER_URL}/.extraheader`;
  } catch {
    // ignore
  }

  const gitUsername = process.env.GITEA_GIT_USERNAME || "oauth2";
  const remoteUrl = `https://${gitUsername}:${giteaToken}@${serverUrl.host}/${context.repository.owner}/${context.repository.repo}.git`;
  await $`git remote set-url origin ${remoteUrl}`;
}

export async function setupSshSigning(sshSigningKey: string): Promise<void> {
  if (!sshSigningKey.trim()) {
    throw new Error("SSH signing key cannot be empty");
  }
  if (!sshSigningKey.includes("BEGIN") || !sshSigningKey.includes("PRIVATE KEY")) {
    throw new Error("Invalid SSH private key format");
  }

  const sshDir = join(homedir(), ".ssh");
  await mkdir(sshDir, { recursive: true, mode: 0o700 });

  const normalizedKey = sshSigningKey.endsWith("\n") ? sshSigningKey : sshSigningKey + "\n";
  await writeFile(SSH_SIGNING_KEY_PATH, normalizedKey, { mode: 0o600 });

  await $`git config gpg.format ssh`;
  await $`git config user.signingkey ${SSH_SIGNING_KEY_PATH}`;
  await $`git config commit.gpgsign true`;
}

export async function cleanupSshSigning(): Promise<void> {
  try {
    await rm(SSH_SIGNING_KEY_PATH, { force: true });
  } catch {
    // ignore
  }
}
