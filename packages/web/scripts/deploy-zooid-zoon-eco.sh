#!/usr/bin/env bash
#
# Deploy this @zooid/web branch from source to the private agent HQ at
# https://zooid.zoon.eco (served from /var/www/zooid on the community EC2 box).
#
# This is the from-source path — the alternative is the npm tarball described in
# the manage-community-ec2 skill. It builds locally, syncs dist/ to the box's web
# root, and preserves the live config.json (homeserver_url). The community server
# (/var/www/zoon) is never touched.
#
# Usage:  pnpm deploy:zooid.zoon.eco
#
# Override via env if access details change:
#   SSH_KEY   (default ~/.ssh/zooid-community.pem)
#   SSH_HOST  (default ubuntu@54.163.68.82)
#   WEB_ROOT  (default /var/www/zooid)
set -euo pipefail

SSH_KEY="${SSH_KEY:-$HOME/.ssh/zooid-community.pem}"
SSH_HOST="${SSH_HOST:-ubuntu@54.163.68.82}"
WEB_ROOT="${WEB_ROOT:-/var/www/zooid}"
SITE_URL="${SITE_URL:-https://zooid.zoon.eco}"

# Resolve the web package dir (parent of this script's dir) regardless of CWD.
PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$PKG_DIR/dist"
SSH="ssh -i $SSH_KEY -o ConnectTimeout=15"

echo "==> Building @zooid/web from source"
pnpm -C "$PKG_DIR" build

echo "==> Backing up live config.json from $SSH_HOST:$WEB_ROOT"
$SSH "$SSH_HOST" "cp $WEB_ROOT/config.json /tmp/zooid-config.json.bak && cat /tmp/zooid-config.json.bak"

echo "==> Staging dist/ to box (excluding macOS resource forks)"
COPYFILE_DISABLE=1 rsync -az --delete \
  --exclude '._*' --exclude '.DS_Store' \
  -e "$SSH" \
  "$DIST_DIR/" "$SSH_HOST:/tmp/zooid-new/"

echo "==> Swapping into $WEB_ROOT (config.json preserved)"
$SSH "$SSH_HOST" "bash -s" <<SH
set -e
sudo rm -rf $WEB_ROOT/assets $WEB_ROOT/._* $WEB_ROOT/.DS_Store 2>/dev/null || true
sudo cp -r /tmp/zooid-new/assets $WEB_ROOT/assets
sudo cp /tmp/zooid-new/index.html $WEB_ROOT/index.html
sudo cp /tmp/zooid-new/favicon.svg $WEB_ROOT/favicon.svg
sudo cp /tmp/zooid-config.json.bak $WEB_ROOT/config.json
rm -rf /tmp/zooid-new
SH

echo "==> Verifying served build"
LOCAL_REFS="$(grep -oE 'assets/[a-zA-Z0-9._-]+' "$DIST_DIR/index.html" | sort)"
SERVED_REFS="$(curl -s "$SITE_URL/" | grep -oE 'assets/[a-zA-Z0-9._-]+' | sort)"
echo "    config.json: $(curl -s "$SITE_URL/config.json")"
if [ "$LOCAL_REFS" = "$SERVED_REFS" ]; then
  echo "    asset hashes match local build — deploy OK"
else
  echo "    WARNING: served asset refs differ from local build (CDN cache or sync issue)"
  echo "    local:  $LOCAL_REFS"
  echo "    served: $SERVED_REFS"
  exit 1
fi

echo "==> Done. Live at $SITE_URL"
