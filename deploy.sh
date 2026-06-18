#!/usr/bin/env bash
# deploy.sh — Build site and deploy directly to Cloudflare Pages from local machine
set -euo pipefail

echo "=== Step 1: Running quality gates (pre-commit) ==="
if command -v pre-commit &>/dev/null; then
	pre-commit run --all-files
else
	echo "Warning: pre-commit not found, skipping..."
fi

echo "=== Step 2: Building site with Zola ==="
zola build

echo "=== Step 3: Deploying to Cloudflare Pages ==="
wrangler pages deploy public --project-name xuepoo-blog --branch main

echo "=== Success! ==="
