import { describe, expect, it } from "bun:test";
import { formatBody, formatComments } from "../src/gitea/data/formatter";

const asGiteaComment = (id: number, body: string, login: string) => ({
  id,
  body,
  user: { login },
  created_at: "2023-01-01T10:00:00Z",
});

describe("Sanitization Integration (Gitea)", () => {
  it("should sanitize complete issue/PR body with hidden content", () => {
    const issueBody = `
# Feature Request: Add user dashboard

## Description
We need a new dashboard for users to track their activity.

<!-- HTML comment that should be removed -->

## Technical Details
The dashboard should display:
- User statistics ![dashboard mockup](dashboard.png)
- Activity graphs <img alt="example graph description" src="graph.jpg">
- Recent actions

## Implementation Notes
See [documentation](https://docs.example.com "internal docs title") for API details.

<div data-instruction="example instruction" aria-label="dashboard label" title="hover text">
  The implementation should follow our standard patterns.
</div>

Additional notes: Text with soft hyphens and &#72;&#105;&#100;&#100;&#101;&#110; encoded content.

<input placeholder="search placeholder" type="text" />`;

    const imageUrlMap = new Map<string, string>();
    const result = formatBody(issueBody, imageUrlMap);

    expect(result).not.toContain("<!-- HTML comment");
    expect(result).not.toContain("internal docs title");
    expect(result).not.toContain("example instruction");
    expect(result).not.toContain("dashboard label");
    expect(result).not.toContain("hover text");
    expect(result).not.toContain("search placeholder");
    expect(result).not.toContain("&#72;");

    expect(result).toContain("# Feature Request: Add user dashboard");
    expect(result).toContain("We need a new dashboard");
    expect(result).toContain("![](dashboard.png)");
    expect(result).toContain('<img src="graph.jpg">');
    expect(result).toContain("[documentation](https://docs.example.com)");
    expect(result).toContain("The implementation should follow our standard patterns");
  });

  it("should sanitize comments preserving flow", () => {
    const comments = [
      asGiteaComment(
        1,
        `Great idea! Here are my thoughts:

1. We should consider the performance impact
2. The UI mockup looks good: ![ui design](mockup.png)
3. Check the [API docs](https://api.example.com "api reference") for rate limits

<div aria-label="comment metadata" data-comment-type="review">
  This change would affect multiple systems.
</div>

Note: Implementation should follow best practices.`,
        "reviewer1",
      ),
      asGiteaComment(
        2,
        `Thanks for the feedback! 

<!-- Internal note: discussed with team -->

I've updated the proposal based on your suggestions.

&#84;&#101;&#115;&#116; note: All systems checked.

<span title="status update" data-status="approved">Ready for implementation</span>`,
        "author1",
      ),
    ];

    const result = formatComments(comments as any);

    expect(result).not.toContain("<!-- Internal note");
    expect(result).not.toContain("api reference");
    expect(result).not.toContain("comment metadata");
    expect(result).not.toContain("status update");
    expect(result).not.toContain("&#84;");

    expect(result).toContain("Great idea! Here are my thoughts:");
    expect(result).toContain("![](mockup.png)");
    expect(result).toContain("[API docs](https://api.example.com)");
    expect(result).toContain("This change would affect multiple systems.");
    expect(result).toContain("Thanks for the feedback!");
    expect(result).toContain("Ready for implementation");
    expect(result).toContain("[reviewer1 at");
    expect(result).toContain("[author1 at");
  });
});
