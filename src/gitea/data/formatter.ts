import type {
  GiteaPullRequest,
  GiteaIssue,
  GiteaComment,
  GiteaChangedFile,
  GiteaPullReview,
} from "../types";
import type { GiteaFileWithSHA } from "./fetcher";
import { sanitizeContent } from "../utils/sanitizer";

export function formatContext(
  contextData: GiteaPullRequest | GiteaIssue,
  isPR: boolean,
): string {
  if (isPR) {
    const prData = contextData as GiteaPullRequest;
    const sanitizedTitle = sanitizeContent(prData.title || "");
    return `PR Title: ${sanitizedTitle}
PR Author: ${prData.user?.login || "unknown"}
PR Branch: ${prData.head?.ref || ""} -> ${prData.base?.ref || ""}
PR State: ${prData.state}
PR Merged: ${prData.merged ? "true" : "false"}`;
  }

  const issueData = contextData as GiteaIssue;
  const sanitizedTitle = sanitizeContent(issueData.title || "");
  return `Issue Title: ${sanitizedTitle}
Issue Author: ${issueData.user?.login || "unknown"}
Issue State: ${issueData.state}`;
}

export function formatBody(
  body: string,
  imageUrlMap: Map<string, string>,
): string {
  let processedBody = body;

  for (const [originalUrl, localPath] of imageUrlMap) {
    processedBody = processedBody.replaceAll(originalUrl, localPath);
  }

  processedBody = sanitizeContent(processedBody);

  return processedBody;
}

export function formatComments(
  comments: GiteaComment[],
  imageUrlMap?: Map<string, string>,
): string {
  return comments
    .map((comment) => {
      let body = comment.body || "";

      if (imageUrlMap && body) {
        for (const [originalUrl, localPath] of imageUrlMap) {
          body = body.replaceAll(originalUrl, localPath);
        }
      }

      body = sanitizeContent(body);

      return `[${comment.user?.login || "unknown"} at ${comment.created_at}]: ${body}`;
    })
    .join("\n\n");
}

export function formatReviewComments(
  reviewData: { nodes: GiteaPullReview[] } | null,
  imageUrlMap?: Map<string, string>,
): string {
  if (!reviewData || !reviewData.nodes) {
    return "";
  }

  const formattedReviews = reviewData.nodes.map((review) => {
    let reviewOutput = `[Review by ${review.user?.login || "unknown"} at ${review.submitted_at || ""}]: ${review.state}`;

    if (review.body && review.body.trim()) {
      let body = review.body;

      if (imageUrlMap) {
        for (const [originalUrl, localPath] of imageUrlMap) {
          body = body.replaceAll(originalUrl, localPath);
        }
      }

      const sanitizedBody = sanitizeContent(body);
      reviewOutput += `\n${sanitizedBody}`;
    }

    return reviewOutput;
  });

  return formattedReviews.join("\n\n");
}

export function formatChangedFiles(changedFiles: GiteaChangedFile[]): string {
  return changedFiles
    .map(
      (file) =>
        `- ${file.filename} (${file.status}) +${file.additions}/-${file.deletions}`,
    )
    .join("\n");
}

export function formatChangedFilesWithSHA(
  changedFiles: GiteaFileWithSHA[],
): string {
  return changedFiles
    .map(
      (file) =>
        `- ${file.filename} (${file.status}) +${file.additions}/-${file.deletions} SHA: ${file.sha}`,
    )
    .join("\n");
}
