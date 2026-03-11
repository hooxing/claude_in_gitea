import { describe, test, expect } from "bun:test";
import { sanitizeContent, redactSensitiveTokens } from "../src/gitea/utils/sanitizer";

describe("sanitizeContent (Gitea)", () => {
  test("removes html comments and hidden attributes", () => {
    const input = `Hello<!-- secret --> <img alt="hidden" title="t" src="a.png"> [link](https://a.b "title")`;
    const result = sanitizeContent(input);
    expect(result).not.toContain("secret");
    expect(result).not.toContain("alt=");
    expect(result).not.toContain("title=");
    expect(result).toContain('<img src="a.png">');
    expect(result).toContain("[link](https://a.b)");
  });
});

describe("redactSensitiveTokens", () => {
  test("redacts github_pat tokens", () => {
    const token = `github_pat_${"B".repeat(20)}`;
    expect(redactSensitiveTokens(`Token: ${token}`)).toBe("Token: [REDACTED_TOKEN]");
  });

  test("redacts ghp tokens", () => {
    const token = `ghp_${"A".repeat(36)}`;
    expect(redactSensitiveTokens(`Token: ${token}`)).toBe("Token: [REDACTED_TOKEN]");
  });

  test("redacts generic 'token ...' patterns", () => {
    expect(redactSensitiveTokens("token abcdefghijklmnopqrstuvwxyz"))
      .toBe("[REDACTED_TOKEN]");
  });
});
