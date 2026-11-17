# Shared setup for Claude Code hook scripts. Source it, don't execute it.
#
# Hooks run in non-interactive shells that don't load the user's profile, so
# pnpm (installed through nvm) may not be on PATH.

if ! command -v pnpm >/dev/null 2>&1; then
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck disable=SC1091
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Hook error: pnpm not found on PATH. Install it or enable nvm." >&2
  exit 1
fi

# The working tree to check is the one containing TREE_HINT (a path set by the
# caller from the hook input), not $CLAUDE_PROJECT_DIR: that stays on the
# folder the session was launched in, even after the session moves into a
# worktree (/implement does, with EnterWorktree).
# A tree from another repository is ignored.
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
common_dir() { git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null; }
if [ -n "${TREE_HINT:-}" ] && hint_root=$(git -C "$TREE_HINT" rev-parse --show-toplevel 2>/dev/null) &&
  [ "$(common_dir "$hint_root")" = "$(common_dir "$PROJECT_DIR")" ]; then
  PROJECT_DIR="$hint_root"
fi
cd "$PROJECT_DIR" || exit 1
