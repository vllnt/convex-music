#!/usr/bin/env bash
#
# One-time first-publish bootstrap for @vllnt/convex-music.
#
# WHY: the package does not exist on npm yet, so OIDC trusted publishing has
# nothing to attach to. This creates the package with a canary build identical
# in shape to what CI produces (`{version}-canary.{sha7}`, dist-tag `canary`).
#
# RUN IT LOCALLY (npm will prompt for your 2FA OTP):
#     bash scripts/first-publish.sh
#
# AFTER it succeeds, enable CI/OIDC for every future publish (one-time):
#     npmjs.com -> @vllnt/convex-music -> Settings -> Trusted Publisher
#       -> GitHub Actions:  repository = vllnt/convex-music,  workflow = publish.yml
# From then on every push to main canary-publishes via OIDC (no token, with
# provenance). This script is then no longer needed and can be deleted.
#
set -euo pipefail

# --- preflight: fail with a clear message, not a confusing "module not found" ---
for t in git node npm pnpm; do
  command -v "$t" >/dev/null 2>&1 || {
    echo "ERROR: '$t' is not on your PATH. Install it and retry." >&2; exit 1; }
done
# Run from the repo root regardless of where you invoke it. If you copied the
# script elsewhere, this is what surfaces as a 'path not found' — cd into your
# convex-music checkout first.
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || {
  echo "ERROR: not inside a git repo. cd into your convex-music checkout, then run:" >&2
  echo "         git pull origin main && bash scripts/first-publish.sh" >&2; exit 1; }
cd "$ROOT"
if [ ! -f package.json ] || [ "$(node -p "require('./package.json').name" 2>/dev/null)" != "@vllnt/convex-music" ]; then
  echo "ERROR: $ROOT is not the @vllnt/convex-music repo root." >&2; exit 1; fi
# --------------------------------------------------------------------------------

PKG=$(node -p "require('./package.json').name")
BASE_VERSION=$(node -p "require('./package.json').version")

# Guard 1 — this is a FIRST-publish bootstrap only. Once the package exists,
# all publishing goes through CI/OIDC (a push to main), never this script.
if npm view "${PKG}" version >/dev/null 2>&1; then
  echo "ERROR: ${PKG} already exists on npm. Use CI/OIDC (push to main) instead." >&2
  exit 1
fi

# Guard 2 — publish exactly what landed on main (clean tree, at origin/main HEAD).
git fetch origin main --quiet
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "ERROR: HEAD is not at origin/main. Check out the landed main commit first." >&2
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: working tree is dirty. Commit or stash first." >&2
  exit 1
fi

# Build the publishable artifact (the gates already ran green in CI on this commit).
echo "==> pnpm install + build"
pnpm install --frozen-lockfile
pnpm build

# Always restore package.json's base version on exit (publish stamps it).
trap 'npm pkg set version="${BASE_VERSION}" >/dev/null 2>&1 || true' EXIT

SHORT_SHA=$(git rev-parse HEAD | cut -c1-7)
CANARY_VERSION="${BASE_VERSION}-canary.${SHORT_SHA}"
npm version "${CANARY_VERSION}" --no-git-tag-version --ignore-scripts >/dev/null

# No --provenance: provenance is generated only by the CI/OIDC run, not a local
# publish. The package is public via publishConfig.access; --access is explicit.
echo "==> publishing ${PKG}@${CANARY_VERSION} (dist-tag: canary) — npm will prompt for your OTP"
npm publish --tag canary --access public --ignore-scripts

echo ""
echo "Published ${PKG}@${CANARY_VERSION}  (dist-tag: canary)"
echo "  Install:  npm i ${PKG}@canary"
echo ""
echo "NEXT (one-time): add the npm Trusted Publisher so CI/OIDC handles all future"
echo "publishes — npmjs.com -> ${PKG} -> Settings -> Trusted Publisher -> GitHub Actions"
echo "(repository: vllnt/convex-music, workflow: publish.yml). Then every push to main"
echo "auto-publishes a fresh canary via OIDC."
