type DiffSide = "LEFT" | "RIGHT";

function normalizePath(path: string): string {
  return path.replace(/^a\//, "").replace(/^b\//, "").replace(/^\/+/, "");
}

type DiffMatch = {
  pathA?: string;
  pathB?: string;
};

function parseDiffHeader(line: string): DiffMatch | null {
  // diff --git a/path b/path
  if (!line.startsWith("diff --git ")) return null;
  const parts = line.split(" ");
  if (parts.length < 4) return null;
  return {
    pathA: normalizePath(parts[2] || ""),
    pathB: normalizePath(parts[3] || ""),
  };
}

function parseHunkHeader(line: string): { oldStart: number; newStart: number } | null {
  const match = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
  if (!match) return null;
  return {
    oldStart: parseInt(match[1] || "0", 10),
    newStart: parseInt(match[2] || "0", 10),
  };
}

export function findDiffPosition(
  diffText: string,
  filePath: string,
  lineNumber: number,
  side: DiffSide,
): number | null {
  const targetPath = normalizePath(filePath);
  const lines = diffText.split("\n");

  let inTargetFile = false;
  let inHunk = false;
  let position = 0;
  let oldLine = 0;
  let newLine = 0;

  for (const line of lines) {
    const header = parseDiffHeader(line);
    if (header) {
      inTargetFile =
        header.pathA === targetPath || header.pathB === targetPath;
      inHunk = false;
      position = 0;
      oldLine = 0;
      newLine = 0;
      continue;
    }

    if (!inTargetFile) continue;

    if (!inHunk) {
      if (line.startsWith("@@")) {
        const hunk = parseHunkHeader(line);
        if (hunk) {
          inHunk = true;
          position += 1;
          oldLine = hunk.oldStart;
          newLine = hunk.newStart;
        }
      }
      continue;
    }

    if (line.startsWith("@@")) {
      const hunk = parseHunkHeader(line);
      if (hunk) {
        position += 1;
        oldLine = hunk.oldStart;
        newLine = hunk.newStart;
      }
      continue;
    }

    if (line.startsWith("\\ No newline")) {
      position += 1;
      continue;
    }

    position += 1;

    if (line.startsWith("+")) {
      if (side === "RIGHT" && newLine === lineNumber) {
        return position;
      }
      newLine += 1;
      continue;
    }

    if (line.startsWith("-")) {
      if (side === "LEFT" && oldLine === lineNumber) {
        return position;
      }
      oldLine += 1;
      continue;
    }

    if (line.startsWith(" ")) {
      if (side === "RIGHT" && newLine === lineNumber) {
        return position;
      }
      if (side === "LEFT" && oldLine === lineNumber) {
        return position;
      }
      oldLine += 1;
      newLine += 1;
    }
  }

  return null;
}
