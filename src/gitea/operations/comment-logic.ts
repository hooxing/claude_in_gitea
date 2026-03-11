import { GITEA_SERVER_URL } from "../api/config";

export type ExecutionDetails = {
  total_cost_usd?: number;
  duration_ms?: number;
  duration_api_ms?: number;
};

export type CommentUpdateInput = {
  currentBody: string;
  actionFailed: boolean;
  executionDetails: ExecutionDetails | null;
  jobUrl: string;
  branchLink?: string;
  prLink?: string;
  branchName?: string;
  triggerUsername?: string;
  errorDetails?: string;
};

export function ensureProperlyEncodedUrl(url: string): string | null {
  try {
    new URL(url);
    if (url.includes(" ")) {
      const [baseUrl, queryString] = url.split("?");
      if (queryString) {
        const params = new URLSearchParams();
        const pairs = queryString.split("&");
        for (const pair of pairs) {
          const [key, value = ""] = pair.split("=");
          if (key) {
            params.set(key, decodeURIComponent(value));
          }
        }
        return `${baseUrl}?${params.toString()}`;
      }
      return url.replace(/ /g, "%20");
    }
    return url;
  } catch (e) {
    try {
      let fixedUrl = url.replace(/ /g, "%20");
      const urlParts = fixedUrl.split("?");
      if (urlParts.length > 1 && urlParts[1]) {
        const [baseUrl, queryString] = urlParts;
        const fixedQuery = queryString.replace(/([^%]|^):(?!%2F%2F)/g, "$1%3A");
        fixedUrl = `${baseUrl}?${fixedQuery}`;
      }
      new URL(fixedUrl);
      return fixedUrl;
    } catch {
      return null;
    }
  }
}

export function updateCommentBody(input: CommentUpdateInput): string {
  const originalBody = input.currentBody;
  const {
    executionDetails,
    jobUrl,
    branchLink,
    prLink,
    actionFailed,
    branchName,
    triggerUsername,
    errorDetails,
  } = input;

  const workingPattern = /Claude Code is working[\.]{1,3}(?:\s*<img[^>]*>)?/i;
  let bodyContent = originalBody.replace(workingPattern, "").trim();

  let prLinkFromContent = "";
  const prLinkPattern = /\[Create .* PR\]\((.*)\)$/m;
  const prLinkMatch = bodyContent.match(prLinkPattern);

  if (prLinkMatch && prLinkMatch[1]) {
    const encodedUrl = ensureProperlyEncodedUrl(prLinkMatch[1]);
    if (encodedUrl) {
      prLinkFromContent = encodedUrl;
      bodyContent = bodyContent.replace(prLinkMatch[0], "").trim();
    }
  }

  let durationStr = "";
  if (executionDetails?.duration_ms !== undefined) {
    const totalSeconds = Math.round(executionDetails.duration_ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  }

  let header = "";

  if (actionFailed) {
    header = "**Claude encountered an error";
    if (durationStr) {
      header += ` after ${durationStr}`;
    }
    header += "**";
  } else {
    const usernameMatch = bodyContent.match(/@([a-zA-Z0-9-]+)/);
    const username =
      triggerUsername || (usernameMatch ? usernameMatch[1] : "user");

    header = `**Claude finished @${username}'s task`;
    if (durationStr) {
      header += ` in ${durationStr}`;
    }
    header += "**";
  }

  let links = ` — [View job](${jobUrl})`;

  if (branchName || branchLink) {
    let finalBranchName = branchName;
    let branchUrl = "";

    if (branchLink) {
      const urlMatch = branchLink.match(/\((https:\/\/.*)\)/);
      if (urlMatch && urlMatch[1]) {
        branchUrl = urlMatch[1];
      }

      if (!finalBranchName) {
        const branchNameMatch = branchLink.match(/branch\/([^"'\)]+)/);
        if (branchNameMatch) {
          finalBranchName = branchNameMatch[1];
        }
      }
    }

    if (!branchUrl && finalBranchName) {
      const repoMatch = jobUrl.match(/\/([^\/]+)\/([^\/]+)\/actions/);
      if (repoMatch) {
        branchUrl = `${GITEA_SERVER_URL}/${repoMatch[1]}/${repoMatch[2]}/src/branch/${finalBranchName}`;
      }
    }

    if (finalBranchName && branchUrl) {
      links += ` — [\`${finalBranchName}\`](${branchUrl})`;
    } else if (finalBranchName) {
      links += ` — \`${finalBranchName}\``;
    }
  }

  const prUrl =
    prLinkFromContent || (prLink ? prLink.match(/\(([^)]+)\)/)?.[1] : "");
  if (prUrl) {
    links += ` — [Create PR](${prUrl})`;
  }

  let newBody = `${header}${links}`;

  if (actionFailed && errorDetails) {
    newBody += `\n\n\`\`\`\n${errorDetails}\n\`\`\``;
  }

  newBody += `\n\n---\n`;

  bodyContent = bodyContent.replace(/\n?\[View job run\]\([^\)]+\)/g, "");
  bodyContent = bodyContent.replace(/\n?\[View branch\]\([^\)]+\)/g, "");
  bodyContent = bodyContent.replace(/\n*---\n*Duration: [0-9]+m? [0-9]+s/g, "");

  newBody += bodyContent;

  return newBody.trim();
}
