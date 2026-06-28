default:
    @just --list

edit:
    @echo "=== Opening Obsidian ==="
    @xdg-open "obsidian://open?path=/mnt/data/Workspace/Projects/xuepoo/xuepoo-blog" || echo "Obsidian CLI not found, please open manually."
    @echo "=== Starting Zola Serve ==="
    @zola serve -p 8085

status:
    @echo "=== Checking repository status ==="
    @git status
    @node scripts/check-assets.js

test:
    @echo "=== Running quality gates ==="
    @if command -v pre-commit &>/dev/null; then pre-commit run --all-files; else echo "pre-commit not found"; fi

deploy: test
    @echo "=== Processing assets and uploading to R2 ==="
    @node scripts/process-and-upload-assets.js
    @echo "=== Building JS bundle ==="
    @bun run build
    @echo "=== Building Zola site ==="
    @zola build
    @echo "=== Obfuscating HTML data ==="
    @bun run obfuscate
    @echo "=== Deploying to Cloudflare Pages ==="
    @./scripts/deploy-pages.sh public xuepoo-blog main

commit message="":
    @if [ -z "{{message}}" ]; then \
        echo "Error: Commit message required. Usage: just commit \"feat(blog): new post\""; \
        exit 1; \
    fi
    @git add -A
    @git commit -m "{{message}}"

push:
    @echo "=== Pushing commits to GitHub ==="
    @git push origin main
