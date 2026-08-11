#!/usr/bin/env bash
# Regenerate the self-hosted, glyph-subsetted Noto SC variable fonts.
#
# The blog renders CJK text through canvas, so the framework needs the real
# font files. Google Fonts' css2 endpoint serves 20+ unicode-range slices per
# family; self-hosting one variable woff2 per family (subset to the exact
# glyphs used anywhere in this repo) cuts that to two requests with no
# third-party dependency.
#
# Re-run after adding posts that introduce NEW characters:
#   ./scripts/subset-fonts.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: $1 not found (install fonttools with brotli: uv tool install fonttools --with brotli)" >&2
    exit 1
  fi
}
require_cmd pyftsubset
require_cmd python3

echo "=== Collecting glyphs used by the site ==="
python3 - "$ROOT" > "$WORK/chars.txt" <<'PY'
import pathlib, sys

root = pathlib.Path(sys.argv[1])
texts = []
for sub in ("content", "src", "templates"):
    for p in (root / sub).rglob("*"):
        if p.is_file() and p.suffix in (".md", ".ts", ".html"):
            try:
                texts.append(p.read_text(encoding="utf-8"))
            except OSError:
                pass
texts.append((root / "zola.toml").read_text(encoding="utf-8"))

chars = set("".join(texts))
chars |= set(chr(c) for c in range(0x20, 0x7F))
chars |= set("，。、；：？！“”‘’（）《》〈〉【】—…·×→←©▸▾‹›§※℃±∞≈≠≤≥－")
chars.discard("\n")
chars.discard("\r")
chars.discard("\t")
print("".join(sorted(chars)), end="")
PY

echo "=== Downloading variable sources ==="
curl -sL --max-time 120 -o "$WORK/NotoSansSC.ttf" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanssc/NotoSansSC%5Bwght%5D.ttf"
curl -sL --max-time 120 -o "$WORK/NotoSerifSC.ttf" \
  "https://raw.githubusercontent.com/google/fonts/main/ofl/notoserifsc/NotoSerifSC%5Bwght%5D.ttf"

echo "=== Subsetting (keeps the variable wght axis) ==="
pyftsubset "$WORK/NotoSansSC.ttf" --text-file="$WORK/chars.txt" --flavor=woff2 \
  --output-file="$ROOT/static/fonts/noto-sans-sc.woff2"
pyftsubset "$WORK/NotoSerifSC.ttf" --text-file="$WORK/chars.txt" --flavor=woff2 \
  --output-file="$ROOT/static/fonts/noto-serif-sc.woff2"

ls -la "$ROOT/static/fonts/"
