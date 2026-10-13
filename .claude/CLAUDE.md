# Project: Tapo.github.io

@global-preferences.md

## Why the import above exists
Cloud sessions run in a fresh container, so `~/.claude/CLAUDE.md` does not persist
between sessions. `global-preferences.md` is a committed copy of the user's general
working preferences so they load in every session for this repo. If the preferences
change, update both `~/.claude/CLAUDE.md` (local machine) and this copy.

## Project notes
- GitHub Pages site. Currently contains only `README.md`; no build system, tests, or dependencies yet.
- Keep Claude config inside `.claude/`: Jekyll (the default GitHub Pages builder) skips
  dot-folders, so a root-level `CLAUDE.md` would be published as a public page.
