import type { ParsedGiteaContext } from "../context";
import type { GiteaClient } from "../api/client";

/**
 * Check if the actor has write permissions to the repository
 */
export async function checkWritePermissions(
  client: GiteaClient,
  context: ParsedGiteaContext,
  allowedNonWriteUsers?: string,
  giteaTokenProvided?: boolean,
): Promise<boolean> {
  const { repository, actor } = context;

  // Bypass logic for allowed users
  if (allowedNonWriteUsers && giteaTokenProvided) {
    const allowedUsers = allowedNonWriteUsers.trim();
    if (allowedUsers === "*") {
      console.warn(
        `SECURITY WARNING: Bypassing write permission check for ${actor} due to allowed_non_write_users='*'.`,
      );
      return true;
    }
    if (allowedUsers) {
      const allowedUserList = allowedUsers
        .split(",")
        .map((u) => u.trim())
        .filter((u) => u.length > 0);
      if (allowedUserList.includes(actor)) {
        console.warn(
          `SECURITY WARNING: Bypassing write permission check for ${actor} due to allowed_non_write_users configuration.`,
        );
        return true;
      }
    }
  }

  try {
    const permission = await client.get<{ permission: string }>(
      `/repos/${repository.owner}/${repository.repo}/collaborators/${actor}/permission`,
    );

    const level = permission.permission;
    if (level === "admin" || level === "write" || level === "owner") {
      return true;
    }
    return false;
  } catch (error) {
    throw new Error(`Failed to check permissions for ${actor}: ${error}`);
  }
}
