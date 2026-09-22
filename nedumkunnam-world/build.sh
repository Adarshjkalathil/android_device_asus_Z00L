#!/usr/bin/env sh
# Builds dist/index.html: one self-contained page, no network needed at runtime.
# The world parts are concatenated in numeric order into window.buildWorld().
set -eu
cd "$(dirname "$0")"
WORLD=$(mktemp)
cat src/world/*.js > "$WORLD"
{
  cat src/head.html
  cat src/body.html
  printf '<script>\n'; cat vendor/three.min.js; printf '\n</script>\n'
  printf '<script>window.__SITE__='; cat data/site.json; printf ';</script>\n'
  printf '<script>\n'; cat "$WORLD"; printf '</script>\n'
  printf '<script>\n'; cat src/boot.js; printf '</script>\n'
} > dist/index.html
rm -f "$WORLD"
echo "built dist/index.html ($(wc -c < dist/index.html) bytes)"
