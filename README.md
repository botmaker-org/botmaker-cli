## How to install botmaker-cli
- Run `npm i -g @botmaker.org/botmaker-cli`

#### Problems on windows?  
- Failed `node-gyp` rebuild and/or `python 2.7` issue  
    - Try running `npm install --global windows-build-tools` on Windows Powershell as Administrator  
    - Create `PYTHON` environment variable and set `C:\Users\YOUR_USER\.windows-build-tools\python27\python.exe` directory  
    - Run `bmc` on bash command-line

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

### `bmc new` flags

| Flag | Description | Folder |
|---|---|---|
| _(none)_ | Regular user client action | `src/user/` |
| `-e` / `--endpoint` | HTTP endpoint | `src/endpoint/` |
| `-a` / `--ai-function` | AI/MCP function (TypeScript) | `src/mcp/` |
| `-w` / `--whatsapp-flow` | WhatsApp Flow endpoint | `src/whatsappflow/` |
| `-f` / `--webchat-form` | Webchat Form endpoint | `src/webchatforms/` |

---

## Running WhatsApp Flow and Webchat Form CAs locally

WHATSAPP_FLOW and WEBCHAT_FORM client actions are driven by a JSON payload that simulates what WhatsApp / Webchat sends to the endpoint. Edit **`testdata.json`** in your workspace root before running.

### testdata.json

```json
{
  "action": "INIT",
  "screen": "",
  "data": {}
}
```

| Field | Type | Description |
|---|---|---|
| `action` | `"INIT"` \| `"data_exchange"` \| `"BACK"` | `INIT` — flow/form just opened. `data_exchange` — user submitted a screen. `BACK` — user navigated back (screen has `refresh_on_back: true`). |
| `screen` | `string` | Name of the screen the user is leaving. Required when `action` is `data_exchange` or `BACK`. Leave empty for `INIT`. |
| `data` | `object` | The payload sent by the flow/form JSON — usually the user's input for the current screen. |

### Running

```bash
bmc run src/whatsappflow/my_flow.js
bmc run src/webchatforms/my_form.js
```

The runner prints:
- `→ nextScreen: SCREEN_NAME` — the screen the CA wants to navigate to
- `→ flow finished (SUCCESS)` — no nextScreen set, flow/form ends
- `→ data: { ... }` — the data passed to the next screen (or back to Botmaker variables on the last screen)

### Testing multi-screen flows

WHATSAPP_FLOW and WEBCHAT_FORM CAs can call `saveScreenData()` to persist the current payload between screens, and `loadPrevScreenData()` to retrieve it in a later screen. Locally, this state is stored in `.bmc-screendata.json` in your workspace root.

To test a full multi-screen flow:

1. Set `testdata.json` to `action: "INIT"`, run — note the `nextScreen` output.
2. Set `action: "data_exchange"`, `screen` to the screen name from step 1, fill `data` with the screen's user input fields, run again.
3. Repeat for each screen until the flow finishes.

To reset saved screen state between test runs, delete `.bmc-screendata.json`.

### botmakerAPI in local runs

`botmakerAPI.getChat()`, `updateChat()`, and `getProducts()` make real HTTP calls to the Botmaker API using your workspace token. Set `botmakerAPI.ACCESS_TOKEN` in your CA code if you need to use a different token (e.g. an Operations API token).
