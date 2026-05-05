# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run the CLI locally
node bin/bmc.js <command>

# Install globally
npm i -g @botmaker.org/botmaker-cli
bmc <command>

# No tests are configured
```

There is no build step for JS files. `src/tsCompiler.ts` is a TypeScript file that is imported directly via `ts-morph` at runtime — it does not need to be compiled separately.

## Architecture

`botmaker-cli` is a local development tool (`bmc`) for Botmaker's **Client Actions (CAs)** — JavaScript/Node.js code snippets deployed to the Botmaker cloud platform. The workflow mirrors Git: initialize a workspace, then push/pull/publish changes against the remote.

### Command Flow

```
bin/bmc.js → src/index.js (yargs router) → command modules
```

`index.js` dispatches to individual modules by command name. Each module (`run.js`, `push.js`, `pull.js`, etc.) is a self-contained async function.

### Workspace

A workspace is a directory containing CA files plus a `.bmc` config file (JSON). The `.bmc` file holds an API token and the list of CAs with their IDs, filenames, types, and cached remote code (`publishedCode`, `unPublishedCode`).

`getWorkspacePath.js` walks up the directory tree to find the `.bmc` file root.

### Client Action Types

- **USER**: Runs in a sandboxed Node.js VM (`caRunner.js` via `vm.runInNewContext`). Has access to Botmaker runtime APIs: `user`, `db`, `redis`, `result`, `require` (for loading helpers), plus bundled libraries (`lodash`, `moment`, `rp`, `xml2js`, etc.).
- **ENDPOINT**: Runs as an Express HTTP server (`caEndpointRunner.js`), default port 7070.

### Status & Sync Model

`getStatus.js` compares the local file contents against the two cached remote states (`publishedCode` / `unPublishedCode`) in `.bmc` to compute a status for each CA (e.g. `LOCAL_CHANGES`, `INCOMING_CHANGES`, `NOT_ADDED`).

`getDiff.js` provides 3-way merge (via `node-diff3`) when both local and remote have diverged.

### TypeScript Compiler (`src/tsCompiler.ts`)

Exposes a `compile(tsCode)` function that:
1. Compiles TypeScript using the `typescript` compiler API against the workspace's `index.d.ts` type definitions.
2. Analyzes the default export function via `ts-morph` to extract JSDoc metadata.
3. Returns `{ code, title, description, inputSchema, outputSchema }` — a compiled JS string plus a JSON Schema derived from the function's TypeScript types and JSDoc comments.

This is used to generate MCP-compatible tool schemas from typed CA code.

### Backend API

All remote calls go through `bmService.js`, which makes HTTP requests to `https://go.botmaker.com/api/v1.0` using the JWT token stored in `.bmc`.

### Workspace Template (`workspaceTemplate/`)

Scaffolding for new workspaces: VS Code launch config, `jsconfig.json` for IntelliSense, and `index.d.ts` — the TypeScript definitions for Botmaker runtime APIs (`user`, `db`, `result`, etc.) available inside CA code.

# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
