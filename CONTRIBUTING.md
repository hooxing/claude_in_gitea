# Contributing to Claude Code Gitea Action

Thank you for your interest in contributing! This guide explains how to set up
a development environment, run the tests, and open a pull request.

---

## Prerequisites

| Tool | Minimum version | Purpose |
|------|-----------------|---------|
| [Bun](https://bun.sh) | 1.1+ | Runtime & test runner |
| [TypeScript](https://www.typescriptlang.org/) | 5.x | Type checking |
| [Gitea](https://gitea.io) | 1.21+ | Target platform (for e2e tests) |

---

## Local Development Setup

```bash
# 1. Clone the repository
git clone https://gitea.example.com/your-org/claude_in_gitea.git
cd claude_in_gitea

# 2. Install dependencies
bun install

# 3. Run the test suite
bun test

# 4. Type-check the project
bun run typecheck

# 5. Format code
bun run format
```

---

## Project Structure

```
claude_in_gitea/
├── src/
│   ├── entrypoints/        # Main entry points (run.ts, etc.)
│   ├── gitea/
│   │   ├── api/            # Gitea REST API client
│   │   ├── data/           # Data fetching (fetcher.ts)
│   │   ├── operations/     # Branch, comment, git-config operations
│   │   ├── validation/     # Permission, trigger, actor, input checks
│   │   └── utils/          # Sanitizer, image downloader, actor filter
│   ├── mcp/                # MCP server implementations
│   ├── modes/              # agent / tag mode orchestration
│   └── utils/              # Shared utilities (retry, action-io, etc.)
├── base-action/            # Shared Claude Code runner logic
├── test/                   # Unit & integration tests (bun:test)
├── docs/                   # User-facing documentation
└── action.yml              # Gitea Action definition
```

---

## Running Tests

```bash
# Run all tests
bun test

# Run a single test file
bun test test/validate-inputs.test.ts

# Run tests matching a pattern
bun test --test-name-pattern "pagination"

# Watch mode (re-runs on file change)
bun test --watch
```

The test suite uses [bun:test](https://bun.sh/docs/cli/test) and runs in ~200 ms.
No external services are required for unit tests.

---

## Code Style

- **TypeScript strict mode** is enabled; avoid `any` casts where possible
- **Structured logging**: use `core.info / core.warning / core.debug` from
  `src/utils/action-io.ts` instead of bare `console.log`
- **Error propagation**: always re-throw after logging unless you have an
  explicit reason to swallow an error
- **Formatting**: run `bun run format` before committing (Prettier 3.x)
- **Validation**: use the Zod schema in `src/gitea/validation/inputs.ts` for
  any new configuration inputs

---

## Adding a New Action Input

1. Add the input to `action.yml` with a clear `description` and `default`
2. Read the value from `process.env` in `src/gitea/context.ts` (`rawInputs`)
3. Add the field to `ActionInputsSchema` in `src/gitea/validation/inputs.ts`
   with appropriate constraints
4. Update the `BaseContext.inputs` TypeScript type if needed
5. Add a test case in `test/validate-inputs.test.ts`
6. Document the new input in `README.md` and/or the relevant `docs/` file

---

## Pull Request Guidelines

- **Small PRs**: one logical change per PR makes review faster
- **Tests first**: add or update tests before implementing a change when possible
- **Describe the "why"**: the PR description should explain the motivation, not
  just what changed
- **No breaking changes without a migration note**: if you change behaviour
  that existing workflows rely on, document the migration path
- **Pass CI**: all tests must pass and `typecheck` must produce no new errors

---

## Reporting Issues

Please include:
- Gitea version and act_runner version
- Relevant workflow YAML (redact secrets)
- The full error output from the workflow run
- Steps to reproduce

---

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](LICENSE).
