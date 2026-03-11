import { describe, expect, test } from "bun:test";
import { findDiffPosition } from "../src/gitea/utils/diff-position";

describe("findDiffPosition", () => {
  const diffText = [
    "diff --git a/src/a.txt b/src/a.txt",
    "index 1234567..89abcde 100644",
    "--- a/src/a.txt",
    "+++ b/src/a.txt",
    "@@ -1,3 +1,4 @@",
    " line1",
    "-line2",
    "+line2b",
    " line3",
    "+line4",
    "",
    "diff --git a/src/b.txt b/src/b.txt",
    "index 1111111..2222222 100644",
    "--- a/src/b.txt",
    "+++ b/src/b.txt",
    "@@ -1,2 +1,2 @@",
    "-old",
    "+new",
    "",
  ].join("\n");

  test("maps RIGHT side line numbers", () => {
    expect(findDiffPosition(diffText, "src/a.txt", 1, "RIGHT")).toBe(2);
    expect(findDiffPosition(diffText, "src/a.txt", 2, "RIGHT")).toBe(4);
    expect(findDiffPosition(diffText, "src/a.txt", 4, "RIGHT")).toBe(6);
  });

  test("maps LEFT side line numbers", () => {
    expect(findDiffPosition(diffText, "src/a.txt", 1, "LEFT")).toBe(2);
    expect(findDiffPosition(diffText, "src/a.txt", 2, "LEFT")).toBe(3);
    expect(findDiffPosition(diffText, "src/a.txt", 3, "LEFT")).toBe(5);
  });

  test("returns null for missing paths", () => {
    expect(findDiffPosition(diffText, "src/missing.txt", 1, "RIGHT")).toBeNull();
  });
});
