#!/usr/bin/env bash
# PostToolUse hook (Write|Edit) for arcade-vault.
# Formats the touched file with Prettier, then lints/fixes it with ESLint.
# On unfixable ESLint errors, exits 2 so the failure is fed back as context.

set -u

# Resolve the project root from this script's own location, not $PWD —
# hooks can run with an arbitrary working directory.
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
project_root="$(cd -- "$script_dir/../.." >/dev/null 2>&1 && pwd)"

input="$(cat)"
file="$(printf '%s' "$input" | jq -r '.tool_response.filePath // .tool_input.file_path // empty' 2>/dev/null)"

# No path, or the tool call didn't actually produce a file on disk.
if [ -z "$file" ] || [ ! -f "$file" ]; then
  exit 0
fi

# Only touch files that live inside this project.
case "$file" in
  "$project_root"/*) ;;
  *) exit 0 ;;
esac

# Skip generated/vendored/reference trees.
rel="${file#"$project_root"/}"
case "$rel" in
  node_modules/*|.next/*|references/*|.git/*|.agents/*)
    exit 0
    ;;
esac

cd "$project_root" || exit 2

errors=""

if ! prettier_out="$(npx --no-install prettier --write --ignore-unknown "$file" 2>&1)"; then
  errors="${errors}Prettier failed on $rel:\n${prettier_out}\n"
fi

case "$file" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs)
    if ! eslint_out="$(npx --no-install eslint --fix "$file" 2>&1)"; then
      errors="${errors}ESLint reported unfixed issues in $rel:\n${eslint_out}\n"
    fi
    ;;
esac

if [ -n "$errors" ]; then
  printf '%b' "$errors" >&2
  exit 2
fi

exit 0
