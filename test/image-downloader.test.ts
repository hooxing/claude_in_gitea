import { describe, test, expect } from "bun:test";
import { downloadCommentImages } from "../src/gitea/utils/image-downloader";
import type { CommentWithImages } from "../src/gitea/utils/image-downloader";

const mockClient = {} as any;

describe("downloadCommentImages (Gitea)", () => {
  test("Gitea 版本默认不下载图片", async () => {
    const comments: CommentWithImages[] = [
      { type: "issue_comment", id: "1", body: "![img](https://example.com/a.png)" },
    ];

    const result = await downloadCommentImages(mockClient, "owner", "repo", comments);
    expect(result.size).toBe(0);
  });
});
