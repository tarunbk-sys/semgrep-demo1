#!/usr/bin/env bash
# Installs the AI code reviewer into a target repo on a new branch (does NOT push).
# Usage: ./install.sh /path/to/target-repo [branch-name]
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${1:-}"
BRANCH="${2:-ai-review-setup}"

[ -n "$TARGET" ] || { echo "Usage: $0 /path/to/target-repo [branch-name]" >&2; exit 1; }
[ -d "$TARGET/.git" ] || { echo "Error: $TARGET is not a git repository root." >&2; exit 1; }
cd "$TARGET"

if [ -n "$(git status --porcelain)" ]; then
  echo "Error: working tree has uncommitted changes. Commit or stash them first." >&2
  exit 1
fi
if [ -e .code-review ] || [ -e .github/workflows/ai-code-review.yml ]; then
  echo "Error: reviewer already installed here (.code-review or workflow exists)." >&2
  exit 1
fi

git checkout -b "$BRANCH"

mkdir -p .code-review .github/workflows
rsync -a --exclude node_modules --exclude .git --exclude install.sh --exclude workflow "$SRC"/ .code-review/
cp "$SRC/workflow/ai-code-review.yml" .github/workflows/ai-code-review.yml

if [ ! -f .codereview.json ]; then
  cat > .codereview.json <<'EOF'
{
  "extraIgnore": [".code-review/**", ".github/**"]
}
EOF
fi

# the reviewer is committed with its lockfile so CI can `npm ci`
[ -f .code-review/package-lock.json ] || { echo "Error: .code-review/package-lock.json missing." >&2; exit 1; }

git add .code-review .github .codereview.json
git commit -q -m "Add AI code review"

REMOTE="$(git remote get-url origin 2>/dev/null || echo '<no origin set>')"
cat <<EOF

Installed on branch '$BRANCH' (not pushed). Remote: $REMOTE

Next:
  1. Add repo secret ANTHROPIC_API_KEY  (Settings > Secrets and variables > Actions)
  2. git push -u origin $BRANCH
  3. Watch the 'ai-code-review' job in the Actions tab
EOF
