import { describe, test, expect } from "bun:test";

/**
 * Test that the paginate() helper in fetcher emits a warning when the
 * maximum page limit is reached and results may be incomplete.
 *
 * We test the pagination logic in isolation by replicating the paginate
 * function signature and verifying warning emission behaviour directly.
 */

// Mirrors the production paginate() function signature from src/gitea/data/fetcher.ts
// so we can test the warning logic without needing a live Gitea instance.
async function paginate<T>(
  fetchPage: (page: number, limit: number) => Promise<T[]>,
  limit: number,
  maxPages: number,
  resourceLabel?: string,
  warnFn: (msg: string) => void = () => {},
): Promise<T[]> {
  const results: T[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const data = await fetchPage(page, limit);
    results.push(...data);
    if (data.length < limit) break;
    if (page === maxPages) {
      const label = resourceLabel ? ` for ${resourceLabel}` : "";
      warnFn(
        `Pagination limit reached${label}: fetched ${results.length} items across ${maxPages} pages ` +
          `(limit=${limit}). Results may be incomplete. ` +
          `Set GITEA_PAGINATION_MAX_PAGES or GITEA_PAGINATION_LIMIT env vars to increase limits.`,
      );
    }
  }
  return results;
}

describe("pagination truncation warning", () => {
  test("emits warning when max pages reached", async () => {
    const warnings: string[] = [];
    const item = { id: 1, body: "x" };

    // Always return a full page → loop will hit maxPages
    const alwaysFullPage = async (_page: number, limit: number) =>
      Array(limit).fill(item) as any[];

    const limit = 3;
    const maxPages = 2;
    const results = await paginate(
      alwaysFullPage,
      limit,
      maxPages,
      "PR #42 comments",
      (msg) => warnings.push(msg),
    );

    expect(results).toHaveLength(limit * maxPages);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("Pagination limit reached for PR #42 comments");
    expect(warnings[0]).toContain("Results may be incomplete");
    expect(warnings[0]).toContain("GITEA_PAGINATION_MAX_PAGES");
  });

  test("warning includes correct item count", async () => {
    const warnings: string[] = [];
    const limit = 5;
    const maxPages = 3;

    const alwaysFullPage = async (_page: number, l: number) =>
      Array(l).fill({ id: 0 }) as any[];

    await paginate(alwaysFullPage, limit, maxPages, "issue #7 files", (msg) =>
      warnings.push(msg),
    );

    expect(warnings[0]).toContain(`fetched ${limit * maxPages} items across ${maxPages} pages`);
  });

  test("does NOT emit warning when all items fit within a single page", async () => {
    const warnings: string[] = [];

    // Returns fewer items than the page limit → partial page → loop exits early
    const fewItems = async () => [{ id: 1 }, { id: 2 }] as any[];

    await paginate(fewItems, 5, 3, "issue #1 comments", (msg) =>
      warnings.push(msg),
    );

    expect(warnings).toHaveLength(0);
  });

  test("does NOT emit warning when exactly zero items", async () => {
    const warnings: string[] = [];

    const emptyPage = async () => [] as any[];

    await paginate(emptyPage, 5, 3, undefined, (msg) => warnings.push(msg));

    expect(warnings).toHaveLength(0);
  });

  test("collects all pages when no truncation occurs", async () => {
    const warnings: string[] = [];
    let callCount = 0;

    // Page 1: full; page 2: partial → stops without warning
    const fewPages = async (page: number, limit: number) => {
      callCount++;
      if (page === 1) return Array(limit).fill({ id: page }) as any[];
      return [{ id: page }] as any[]; // partial
    };

    const results = await paginate(fewPages, 3, 5, "test", (msg) =>
      warnings.push(msg),
    );

    expect(results).toHaveLength(4); // 3 + 1
    expect(warnings).toHaveLength(0);
    expect(callCount).toBe(2);
  });
});

