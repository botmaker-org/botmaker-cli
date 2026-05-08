# Schedule CA Cron Attribute — Design Spec

**Date:** 2026-05-08  
**Status:** Approved

## Summary

SCHEDULE type Client Actions need a `schedule` attribute holding a valid 5-field cron expression. This attribute must be set at creation time and must be changeable on existing SCHEDULE CAs via a dedicated CLI command.

## CLI Interface

### Creation

```
bmc new <caName> --schedule-ca "0 * * * *"
bmc new <caName> -S "0 * * * *"
```

- `-S` / `--schedule-ca` takes the cron string as its value.
- Implies `type = SCHEDULE`; mutually exclusive with `-e`, `-a`, `-w`, `-f` — combining any two type flags throws an error before creation.
- Validates the cron string locally before any API call.
- Errors out with a clear message if the expression is invalid.

### Updating

```
bmc set-schedule <caName> <cronString>
```

- Looks up the CA by name or file path.
- Validates the cron string locally before any API call.
- Errors out if the CA is not of type `SCHEDULE`.
- Sends `{ id, schedule: cronString }` to `updateCas`.
- Updates the local `.bmc` entry with the new `schedule` value.

## Cron Validation

- Library: `cron-validator` npm package.
- Call: `isValidCron(cronString, { seconds: false })` — 5-field only.
- Error message: `Invalid cron expression: "<value>". Expected a valid 5-field cron string (e.g. "0 * * * *").`
- Validation runs in both creation and update paths (two call sites, no shared helper).

## Files Changed

| File | Change |
|---|---|
| `package.json` | Add `cron-validator` dependency |
| `src/index.js` | Add `-S`/`--schedule-ca` option to `new` command; add `set-schedule` command and its switch case |
| `src/newCa.js` | Accept `schedule` param; include in `createCa` payload; add `SCHEDULE` code template; validate cron before API call |
| `src/setSchedule.js` | New file — mirrors `rename.js`; validates cron, checks type is SCHEDULE, calls `updateCas`, updates `.bmc` |

## Data Model

The `schedule` field is added to the CA object in `.bmc` when present. It is passed as-is to the Botmaker API in create and update calls. No other local handling is needed.

## Error Cases

| Condition | Behavior |
|---|---|
| Invalid cron string | Throw before API call with descriptive message |
| CA is not type SCHEDULE (set-schedule) | Throw with message indicating wrong type |
| CA not found | Existing `getCaByNameOrPath` throws |

## Out of Scope

- 6-field cron (with seconds)
- Reading/displaying the current schedule value in `status` or `diff`
- A shared validation helper (duplicated at two call sites)
