import { describe, test, expect } from "bun:test";
import { mkdtemp, writeFile, rm, mkdir } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const e2eEnabled = process.env.GITEA_E2E === "1";
const run = e2eEnabled ? test : test.skip;

const baseUrl =
  process.env.GITEA_BASE_URL ||
  process.env.GITEA_SERVER_URL ||
  "";
const token = process.env.GITEA_TOKEN || "";
const repo = process.env.GITEA_REPO || ""; // owner/repo
const defaultBranch = process.env.GITEA_DEFAULT_BRANCH || "main";
const gitUsername = process.env.GITEA_GIT_USERNAME || "oauth2";
const expectFinal = process.env.GITEA_EXPECT_FINAL === "1";

const pollIntervalMs = Number.parseInt(
  process.env.GITEA_REVIEW_POLL_INTERVAL_MS || "3000",
  10,
);
const timeoutMs = Number.parseInt(
  process.env.GITEA_REVIEW_TIMEOUT_MS || "180000",
  10,
);

function decodeOutput(data?: Uint8Array) {
  if (!data) return "";
  return new TextDecoder().decode(data).trim();
}

function runGit(args: string[], cwd: string) {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const stdout = decodeOutput(result.stdout);
    const stderr = decodeOutput(result.stderr);
    throw new Error(`git ${args.join(" ")} failed:\n${stdout}\n${stderr}`);
  }
}

async function apiRequest<T>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Accept: "application/json",
      Authorization: `token ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status} ${response.statusText}: ${text}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollForComment(
  owner: string,
  repoName: string,
  prNumber: number,
  predicate: (body: string) => boolean,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  const commentsUrl = `${baseUrl.replace(/\/$/, "")}/api/v1/repos/${owner}/${repoName}/issues/${prNumber}/comments`;

  while (Date.now() < deadline) {
    const comments = await apiRequest<Array<{ body?: string }>>(commentsUrl);
    const match = comments.find((comment) =>
      comment.body ? predicate(comment.body) : false,
    );
    if (match?.body) return match.body;
    await sleep(pollIntervalMs);
  }

  throw new Error("Timed out waiting for review comment");
}

describe("E2E: PR auto review", () => {
  run("creates review comment for PR opened", async () => {
    if (!baseUrl || !token || !repo) {
      throw new Error(
        "Missing required env: GITEA_BASE_URL/GITEA_SERVER_URL, GITEA_TOKEN, GITEA_REPO",
      );
    }

    const gitVersion = Bun.spawnSync(["git", "--version"]);
    if (gitVersion.exitCode !== 0) {
      throw new Error("git is required for this E2E test");
    }

    const [owner, repoName] = repo.split("/");
    if (!owner || !repoName) {
      throw new Error("GITEA_REPO must be in the form owner/repo");
    }

    const tmpDir = await mkdtemp(join(tmpdir(), "gitea-e2e-"));
    const branchName = `e2e/auto-review-${Date.now()}`;
    const repoUrl = new URL(`${baseUrl.replace(/\/$/, "")}/${owner}/${repoName}.git`);
    repoUrl.username = gitUsername;
    repoUrl.password = token;

    let prNumber: number | undefined;

    try {
      runGit(["clone", "--no-tags", repoUrl.toString(), tmpDir], tmpDir);
      runGit(["-C", tmpDir, "checkout", "-b", branchName], tmpDir);

      const e2eDir = join(tmpDir, "e2e");
      await mkdir(e2eDir, { recursive: true });
      const filePath = join(e2eDir, `auto-review-${Date.now()}.txt`);
      await writeFile(filePath, "e2e auto review\n");

      runGit(["-C", tmpDir, "add", filePath], tmpDir);
      runGit(["-C", tmpDir, "config", "user.name", "e2e-bot"], tmpDir);
      runGit(["-C", tmpDir, "config", "user.email", "e2e-bot@example.com"], tmpDir);
      runGit(["-C", tmpDir, "commit", "-m", "test: e2e auto review"], tmpDir);
      runGit(["-C", tmpDir, "push", "origin", `HEAD:${branchName}`], tmpDir);

      const pr = await apiRequest<{ number: number }>(
        `${baseUrl.replace(/\/$/, "")}/api/v1/repos/${owner}/${repoName}/pulls`,
        {
          method: "POST",
          body: {
            title: "E2E: auto review",
            head: branchName,
            base: defaultBranch,
            body: "E2E auto review test (no @claude required).",
          },
        },
      );
      prNumber = pr.number;

      const initialBody = await pollForComment(
        owner,
        repoName,
        prNumber,
        (body) => body.includes("Claude Code is working"),
      );
      expect(initialBody).toContain("Claude Code is working");

      if (expectFinal) {
        const finalBody = await pollForComment(
          owner,
          repoName,
          prNumber,
          (body) => body.includes("Claude finished"),
        );
        expect(finalBody).toContain("Claude finished");
      }
    } finally {
      try {
        if (prNumber) {
          await apiRequest(
            `${baseUrl.replace(/\/$/, "")}/api/v1/repos/${owner}/${repoName}/issues/${prNumber}`,
            { method: "PATCH", body: { state: "closed" } },
          );
        }
      } catch {
        // ignore cleanup errors
      }

      try {
        await apiRequest(
          `${baseUrl.replace(/\/$/, "")}/api/v1/repos/${owner}/${repoName}/branches/${encodeURIComponent(branchName)}`,
          { method: "DELETE" },
        );
      } catch {
        // ignore cleanup errors
      }

      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});