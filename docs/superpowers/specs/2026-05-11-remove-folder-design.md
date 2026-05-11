# Design: Remove Folder Implementation

**Date:** 2026-05-11  
**Status:** Approved  
**Branch:** feat/mcpAndTs

---

## Goal

Remove the folder concept entirely. All CAs live directly in `src/{typeFolder}/` with no subdirectory nesting. New CAs and pulled CAs are placed at the type root. Folder tracking, sync, and path utilities are deleted.

---

## What Folder Was

The `folder` field on a CA allowed organizing files into subdirectories within their type folder — e.g., `src/user/myfolder/myca.js`. The CLI tracked the folder bidirectionally: pull moved files when the remote folder changed, push sent local folder changes to the API. `buildLocalRelPath`, `extractFolderFromFilename`, and `cleanFolder` in `caTypes.js` powered this.

---

## Changes by File

### `src/caTypes.js`

- Remove `cleanFolder`
- Remove `extractFolderFromFilename`
- Simplify `buildLocalRelPath(type, folder, basename)` → `buildLocalRelPath(type, basename)`:
  - Drop `folder` parameter
  - Path becomes `src/{typeFolder}/{basename}` (no intermediate subfolder segment)

### `src/getStatus.js`

- Remove `FOLDER_CHANGED` and `LOCAL_FOLDER_CHANGED` from `ChangeType` (lines 118–132)
- Remove `d` (remote folder: `ca.folder != null ? ca.folder : ''`) from status computation (line 314)
- Remove `g` (local folder: `extractFolderFromFilename(actualRel, ca.type)`) from status computation (line 315)
- Remove `D: folder != null ? folder : ''` from all returned status shapes

### `src/importWorkspace.js`

- Remove `const remoteFolder = ca.folder || ''`
- Change `buildLocalRelPath(ca.type, remoteFolder, basename)` → `buildLocalRelPath(ca.type, basename)`
- Remove folder from target directory construction (no `remoteFolder` in path join)
- Stop writing `ca.folder = remoteFolder` into the saved CA object

### `src/newCa.js`

- Remove `const remoteFolder = ca.folder || ''`
- Change `buildLocalRelPath(type, remoteFolder, basename)` → `buildLocalRelPath(type, basename)`
- Remove folder from target directory construction
- Stop returning `folder: remoteFolder` from `createFileAndStatus`

### `src/push.js`

- Remove `hasLocalFolder` check (line 24)
- Remove `if (hasLocalFolder) payload.folder = status.g || '';` (line 31)
- Remove `|| c === ChangeType.FOLDER_CHANGED` from the changes filter (line 46)
- Remove the `if (u.payload.folder !== undefined)` block that updated `next.folder` and `next.filename` (lines 55–58)
- Remove folder tag from logging (line 109)

### `src/pull.js`

- Simplify `targetDirForNew(wpPath, type, folder)` → `targetDirForNew(wpPath, type)` — drop folder param, use `buildLocalRelPath(type, basename)` directly
- Remove `hasFolderChanged` and the file-move branch it gates (lines 55, 83, 107)
- Change all `buildLocalRelPath(status.T, status.D, basename)` → `buildLocalRelPath(status.T, basename)`
- Remove `folder: status.D || ''` from CA object updates (lines 146, 157)

---

## What Does NOT Change

- Existing CA files in subfolders continue to work — their full paths are stored verbatim in `.bmc` and are not re-derived from type + folder
- The `ca.folder` field may still exist in old `.bmc` entries; it is silently ignored going forward
- No error is thrown for CAs found in subfolders

---

## Success Criteria

- `buildLocalRelPath` takes 2 arguments (`type`, `basename`) and produces `src/{typeFolder}/{basename}`
- `cleanFolder` and `extractFolderFromFilename` do not exist
- `FOLDER_CHANGED` and `LOCAL_FOLDER_CHANGED` do not exist in `ChangeType`
- `bmc new myca` creates `src/user/myca.js` (not in any subfolder)
- `bmc pull` does not move files based on remote folder changes
- `bmc push` does not send `folder` in its payload
- All modules load without error
