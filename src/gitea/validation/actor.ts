#!/usr/bin/env bun

import type { GiteaClient } from "../api/client";
import type { GiteaContext } from "../context";

export async function checkHumanActor(
  client: GiteaClient,
  giteaContext: GiteaContext,
) {
  const actor = giteaContext.actor;
  const allowedBots = giteaContext.inputs.allowedBots;

  if (allowedBots.trim() === "*") {
    console.log(
      `All bots are allowed, skipping human actor check for: ${actor}`,
    );
    return;
  }

  const allowedBotsList = allowedBots
    .split(",")
    .map((bot) => bot.trim().toLowerCase())
    .filter((bot) => bot.length > 0);

  let user: { login: string; is_admin?: boolean } | null = null;
  try {
    user = await client.get<{ login: string; is_admin?: boolean }>(
      `/users/${actor}`,
    );
  } catch {
    // If we can't fetch user info, fall back to allowlist check only
    if (allowedBotsList.includes(actor.toLowerCase())) {
      console.log(`Bot ${actor} is in allowed list, skipping human actor check`);
      return;
    }
    if (actor.toLowerCase().includes("bot")) {
      throw new Error(
        `Workflow initiated by suspected bot actor: ${actor}. Add bot to allowed_bots list or use '*' to allow all bots.`,
      );
    }
    return;
  }

  const login = user.login.toLowerCase();
  const looksLikeBot = login.endsWith("[bot]") || login.includes("bot");

  if (looksLikeBot && !allowedBotsList.includes(login)) {
    throw new Error(
      `Workflow initiated by non-human actor: ${login}. Add bot to allowed_bots list or use '*' to allow all bots.`,
    );
  }

  console.log(`Verified actor: ${actor}`);
}
