#!/bin/bash
# Installs the global "find-skills" agent skill in Claude Code cloud sessions.
set -euo pipefail

# Only run in remote (cloud) sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Skip if already installed (the hook runs on every start/resume/clear/compact)
if [ -f "$HOME/.agents/skills/find-skills/SKILL.md" ] && [ -e "$HOME/.claude/skills/find-skills" ]; then
  exit 0
fi

npx -y skills add https://github.com/vercel-labs/skills --skill find-skills -g -y >/dev/null
