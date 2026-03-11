import { execFileSync } from "child_process";
import type { GiteaClient } from "../api/client";
import {
  isIssueCommentEvent,
  isIssuesEvent,
  isPullRequestEvent,
  isPullRequestReviewEvent,
  isPullRequestReviewCommentEvent,
  type ParsedGiteaContext,
} from "../context";
import type {
  GiteaComment,
  GiteaChangedFile,
  GiteaIssue,
  GiteaPullRequest,
  GiteaPullReview,
  GiteaPullReviewComment,
} from "../types";
import type { CommentWithImages } from "../utils/image-downloader";
import { downloadCommentImages } from "../utils/image-downloader";
import {
  parseActorFilter,
  shouldIncludeCommentByActor,
} from "../utils/actor-filter";

export function extractTriggerTimestamp(
  context: ParsedGiteaContext,
): string | undefined {
  if (isIssueCommentEvent(context)) {
    return context.payload.comment.created_at || undefined;
  }
  if (isPullRequestReviewEvent(context)) {
    return (
      context.payload.review?.submitted_at ||
      (context.payload.review as any)?.created_at ||
      undefined
    );
  }
  if (isPullRequestReviewCommentEvent(context)) {
    return (
      context.payload.comment?.created_at ||
      context.payload.review?.submitted_at ||
      undefined
    );
  }
  return undefined;
}

export function extractOriginalTitle(
  context: ParsedGiteaContext,
): string | undefined {
  if (isIssueCommentEvent(context)) {
    return context.payload.issue?.title;
  }
  if (isPullRequestEvent(context)) {
    return context.payload.pull_request?.title;
  }
  if (isPullRequestReviewEvent(context)) {
    return context.payload.pull_request?.title;
  }
  if (isPullRequestReviewCommentEvent(context)) {
    return context.payload.pull_request?.title;
  }
  if (isIssuesEvent(context)) {
    return context.payload.issue?.title;
  }
  return undefined;
}

export function extractOriginalBody(
  context: ParsedGiteaContext,
): string | null | undefined {
  if (isIssueCommentEvent(context)) {
    return context.payload.issue?.body;
  }
  if (isPullRequestEvent(context)) {
    return context.payload.pull_request?.body;
  }
  if (isPullRequestReviewEvent(context)) {
    return context.payload.pull_request?.body;
  }
  if (isPullRequestReviewCommentEvent(context)) {
    return context.payload.pull_request?.body;
  }
  if (isIssuesEvent(context)) {
    return context.payload.issue?.body;
  }
  return undefined;
}

export function filterCommentsToTriggerTime<
  T extends { created_at: string; updated_at?: string },
>(comments: T[], triggerTime: string | undefined): T[] {
  if (!triggerTime) return comments;
  const triggerTimestamp = new Date(triggerTime).getTime();

  return comments.filter((comment) => {
    const createdTimestamp = new Date(comment.created_at).getTime();
    if (createdTimestamp >= triggerTimestamp) return false;

    if (comment.updated_at) {
      const updatedTimestamp = new Date(comment.updated_at).getTime();
      if (updatedTimestamp >= triggerTimestamp) return false;
    }

    return true;
  });
}

export function filterReviewsToTriggerTime<
  T extends { submitted_at?: string; updated_at?: string },
>(reviews: T[], triggerTime: string | undefined): T[] {
  if (!triggerTime) return reviews;
  const triggerTimestamp = new Date(triggerTime).getTime();

  return reviews.filter((review) => {
    if (!review.submitted_at) return true;
    const submittedTimestamp = new Date(review.submitted_at).getTime();
    if (submittedTimestamp >= triggerTimestamp) return false;
    if (review.updated_at) {
      const updatedTimestamp = new Date(review.updated_at).getTime();
      if (updatedTimestamp >= triggerTimestamp) return false;
    }
    return true;
  });
}

export function isBodySafeToUse(
  contextData: { created_at: string; updated_at?: string },
  triggerTime: string | undefined,
): boolean {
  if (!triggerTime) return true;
  const triggerTimestamp = new Date(triggerTime).getTime();
  if (contextData.updated_at) {
    const updatedTimestamp = new Date(contextData.updated_at).getTime();
    if (updatedTimestamp >= triggerTimestamp) return false;
  }
  return true;
}

export function filterCommentsByActor<T extends { user?: { login?: string } }>(
  comments: T[],
  includeActors: string = "",
  excludeActors: string = "",
): T[] {
  const includeParsed = parseActorFilter(includeActors);
  const excludeParsed = parseActorFilter(excludeActors);

  if (includeParsed.length === 0 && excludeParsed.length === 0) {
    return comments;
  }

  return comments.filter((comment) => {
    const login = comment.user?.login || "";
    return shouldIncludeCommentByActor(login, includeParsed, excludeParsed);
  });
}

type FetchDataParams = {
  client: GiteaClient;
  repository: string;
  prNumber: string;
  isPR: boolean;
  triggerUsername?: string;
  triggerTime?: string;
  originalTitle?: string;
  originalBody?: string | null;
  includeCommentsByActor?: string;
  excludeCommentsByActor?: string;
};

export type GiteaFileWithSHA = GiteaChangedFile & {
  sha: string;
};

export type GiteaReviewWithComments = GiteaPullReview & {
  comments?: { nodes: GiteaPullReviewComment[] };
};

export type FetchDataResult = {
  contextData: GiteaPullRequest | GiteaIssue;
  comments: GiteaComment[];
  changedFiles: GiteaChangedFile[];
  changedFilesWithSHA: GiteaFileWithSHA[];
  reviewData: { nodes: GiteaReviewWithComments[] } | null;
  imageUrlMap: Map<string, string>;
  triggerDisplayName?: string | null;
};

async function paginate<T>(
  fetchPage: (page: number, limit: number) => Promise<T[]>,
  limit = 50,
  maxPages = 10,
): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchPage(page, limit);
    results.push(...data);
    if (data.length < limit) break;
  }
  return results;
}

export async function fetchGiteaData({
  client,
  repository,
  prNumber,
  isPR,
  triggerUsername,
  triggerTime,
  originalTitle,
  originalBody,
  includeCommentsByActor,
  excludeCommentsByActor,
}: FetchDataParams): Promise<FetchDataResult> {
  const [owner, repo] = repository.split("/");
  if (!owner || !repo) {
    throw new Error("Invalid repository format. Expected 'owner/repo'.");
  }

  let contextData: GiteaPullRequest | GiteaIssue | null = null;
  let comments: GiteaComment[] = [];
  let changedFiles: GiteaChangedFile[] = [];
  let reviewData: { nodes: GiteaReviewWithComments[] } | null = null;

  if (isPR) {
    const pr = await client.get<GiteaPullRequest>(
      `/repos/${owner}/${repo}/pulls/${prNumber}`,
    );
    contextData = pr;

    const files = await paginate<GiteaChangedFile>((page, limit) =>
      client.get(`/repos/${owner}/${repo}/pulls/${prNumber}/files`, {
        page,
        limit,
      }),
    );
    changedFiles = files || [];

    const issueComments = await paginate<GiteaComment>((page, limit) =>
      client.get(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
        page,
        limit,
      }),
    );

    comments = filterCommentsByActor(
      filterCommentsToTriggerTime(issueComments, triggerTime),
      includeCommentsByActor,
      excludeCommentsByActor,
    );

    const reviews = await paginate<GiteaPullReview>((page, limit) =>
      client.get(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, {
        page,
        limit,
      }),
    );

    const reviewWithComments: GiteaReviewWithComments[] = [];
    for (const review of reviews) {
      const reviewComments = await paginate<GiteaPullReviewComment>(
        (page, limit) =>
          client.get(
            `/repos/${owner}/${repo}/pulls/${prNumber}/reviews/${review.id}/comments`,
            { page, limit },
          ),
      );
      reviewWithComments.push({
        ...review,
        comments: { nodes: reviewComments || [] },
      });
    }
    reviewData = { nodes: reviewWithComments };
  } else {
    const issue = await client.get<GiteaIssue>(
      `/repos/${owner}/${repo}/issues/${prNumber}`,
    );
    contextData = issue;

    const issueComments = await paginate<GiteaComment>((page, limit) =>
      client.get(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
        page,
        limit,
      }),
    );

    comments = filterCommentsByActor(
      filterCommentsToTriggerTime(issueComments, triggerTime),
      includeCommentsByActor,
      excludeCommentsByActor,
    );
  }

  if (!contextData) {
    throw new Error(`Failed to fetch ${isPR ? "PR" : "issue"} data`);
  }

  let changedFilesWithSHA: GiteaFileWithSHA[] = [];
  if (isPR && changedFiles.length > 0) {
    changedFilesWithSHA = changedFiles.map((file) => {
      const isDeleted =
        file.status?.toLowerCase() === "removed" ||
        file.status?.toLowerCase() === "deleted";
      if (isDeleted) {
        return { ...file, sha: "deleted" };
      }
      try {
        const sha = execFileSync("git", ["hash-object", file.filename], {
          encoding: "utf-8",
        }).trim();
        return { ...file, sha };
      } catch {
        return { ...file, sha: "unknown" };
      }
    });
  }

  // Prepare comments for image processing (currently no-op in Gitea)
  const issueComments: CommentWithImages[] = comments
    .filter((c) => c.body)
    .map((c) => ({
      type: "issue_comment" as const,
      id: String(c.id),
      body: c.body,
    }));

  const reviewBodies: CommentWithImages[] =
    reviewData?.nodes
      ?.filter((r) => r.body)
      .map((r) => ({
        type: "review_body" as const,
        id: String(r.id),
        pullNumber: prNumber,
        body: r.body || "",
      })) || [];

  const reviewComments: CommentWithImages[] =
    reviewData?.nodes
      ?.flatMap((r) => r.comments?.nodes || [])
      .filter((c) => c.body)
      .map((c) => ({
        type: "review_comment" as const,
        id: String(c.id),
        body: c.body,
      })) || [];

  if (originalBody !== undefined) {
    contextData.body = originalBody ?? "";
  }

  let mainBody: CommentWithImages[] = [];
  if (contextData.body) {
    if (originalBody !== undefined || isBodySafeToUse(contextData as any, triggerTime)) {
      mainBody = [
        isPR
          ? { type: "pr_body" as const, pullNumber: prNumber, body: contextData.body }
          : { type: "issue_body" as const, issueNumber: prNumber, body: contextData.body },
      ];
    }
  }

  const allComments = [...mainBody, ...issueComments, ...reviewBodies, ...reviewComments];
  const imageUrlMap = await downloadCommentImages(client, owner, repo, allComments);

  let triggerDisplayName: string | null | undefined;
  if (triggerUsername) {
    triggerDisplayName = await fetchUserDisplayName(client, triggerUsername);
  }

  if (originalTitle !== undefined) {
    contextData.title = originalTitle;
  }

  return {
    contextData,
    comments,
    changedFiles,
    changedFilesWithSHA,
    reviewData,
    imageUrlMap,
    triggerDisplayName,
  };
}

export async function fetchUserDisplayName(
  client: GiteaClient,
  login: string,
): Promise<string | null> {
  try {
    const user = await client.get<{ full_name?: string }>(`/users/${login}`);
    return user.full_name || null;
  } catch {
    return null;
  }
}
