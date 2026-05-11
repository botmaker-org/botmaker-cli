## How to install botmaker-cli
- Run `npm i -g @botmaker.org/botmaker-cli`

---

## Commands

| Command | Alias | Description |
|---|---|---|
| `bmc import <apiToken>` | `bmc i` | Import a workspace from an API token |
| `bmc new <name>` | `bmc n` | Create a new client action (see flags below) |
| `bmc run <file>` | `bmc r` | Run a client action locally |
| `bmc push [name]` | | Push local changes to Botmaker |
| `bmc pull [name]` | | Pull remote changes |
| `bmc publish <name>` | | Publish a client action |
| `bmc status [name]` | `bmc s` | Show change status |
| `bmc diff <name> <code>` | `bmc d` | Diff local vs remote |
| `bmc rename <name> <newName>` | | Rename a client action |
| `bmc set-schedule <name> <cronString>` | | Set the cron schedule on a SCHEDULE type CA |
| `bmc reset` | | Reset local workspace state (chat.json, catalog.json) |

### `bmc new` flags

| Flag | Description | Folder |
|---|---|---|
| _(none)_ | Regular user client action | `src/user/` |
| `-e` / `--endpoint` | HTTP endpoint | `src/endpoint/` |
| `-a` / `--ai-function` | AI/MCP function (TypeScript) | `src/mcp/` |
| `-S "0 * * * *"` / `--schedule-ca` | Scheduled task (5-field cron expression) | `src/schedule/` |

---

## Running MCP / AI Function CAs locally

MCP CAs are TypeScript files in `src/mcp/` that export a default async function. The runner compiles the TypeScript, infers parameter names from the function signature, and calls the function with the values you supply via `-p`.

### Running

```bash
bmc run src/mcp/myFunction.ts
```

### Passing parameters

Use `-p <paramName> <paramValue>` for each parameter. Parameter names must match the function's TypeScript parameter names:

```bash
bmc run src/mcp/myFunction.ts -p city "New York" -p units "metric"
```

Multiple `-p` flags are supported. Parameter values are always passed as strings — cast inside the function if needed.

### Setting user variables

Use `-v <varName> <varValue>` to inject values into `User.get()` / `User.set()` context:

```bash
bmc run src/mcp/myFunction.ts -p query "hello" -v userId "abc123"
```

### Example CA

```typescript
/**
 * Looks up weather for a city
 * @param city - City name to query
 * @param units - Temperature units: "metric" or "imperial"
 */
export default async function getWeather(city: string, units: string) {
  return { city, units, temperature: 22 };
}
```

The output is printed as formatted JSON:

```json
{
  "city": "New York",
  "units": "metric",
  "temperature": 22
}
```

### Flags

| Flag | Description |
|---|---|
| `-p <name> <value>` | Pass a named parameter to the function |
| `-v <name> <value>` | Set a user variable accessible via `User.get()` |
| `--volatile` | Skip persisting state to `context.json` after the run |

---
