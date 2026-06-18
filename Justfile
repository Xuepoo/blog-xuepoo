default:
    @just --list

edit:
    @echo "=== Starting Dev API & Zola Serve ==="
    @node scripts/editor-server.js

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
    @echo "=== Building Zola site ==="
    @zola build
    @echo "=== Deploying to Cloudflare Pages ==="
    @wrangler pages deploy public --project-name xuepoo-blog --branch main

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
