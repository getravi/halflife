#!/bin/bash
# Sweep every URL in resources_db.js and index.html for liveness.
#
# Two traps this handles that a plain status check does not:
#   - YouTube watch pages return 200 for deleted videos, so videos go through
#     the oEmbed API instead. A 401 there means embedding is disabled, not that
#     the video is gone — those are reported separately, not as failures.
#   - Some doc sites serve soft-404s: HTTP 200 with a tiny JS redirect shell.
#     Bodies under 1000 bytes are flagged for a human to look at.
#
# Usage: make links      (or: bash tools/link_check.sh)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${TMPDIR:-/tmp}/flp_links"
mkdir -p "$OUT"
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36"

node -e "
global.window={};require('$ROOT/resources_db.js');const db=window.RESOURCES_DB;
const u=new Set();
for(const p of Object.keys(db))for(const t of Object.keys(db[p]))for(const s of Object.keys(db[p][t]))
 for(const c of ['courses','papers','lectures','docs','videos','podcasts'])
  for(const e of (db[p][t][s][c]||[]))u.add(e.url);
const h=require('fs').readFileSync('$ROOT/index.html','utf8');
for(const m of h.matchAll(/href=\"(https?:\/\/[^\"]+)\"/g))u.add(m[1]);
console.log([...u].join('\n'));
" > "$OUT/urls.txt"

total=$(wc -l < "$OUT/urls.txt" | tr -d ' ')
echo "sweeping $total unique URLs (parallel, be patient)..."

check_one() {
  local u="$1" code size
  case "$u" in
    *youtube.com/watch*)
      local id="${u##*v=}"; id="${id%%&*}"
      code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 20 \
        "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=$id&format=json")
      [ "$code" = "401" ] && code="EMBED_OFF"
      size=- ;;
    *)
      read -r code size < <(curl -sSL -o /dev/null -w "%{http_code} %{size_download}" \
        --max-time 25 -A "$UA" "$u" 2>/dev/null || echo "000 0") ;;
  esac
  printf "%s\t%s\t%s\n" "$code" "$size" "$u"
}
export -f check_one 2>/dev/null || true
export UA

: > "$OUT/results.tsv"
while IFS= read -r u; do
  printf '%s\n' "$u"
done < "$OUT/urls.txt" | xargs -P 8 -I{} bash -c 'check_one "$1"' _ {} >> "$OUT/results.tsv" 2>/dev/null

echo
echo "=== status distribution ==="
cut -f1 "$OUT/results.tsv" | sort | uniq -c | sort -rn

bad=$(awk -F'\t' '$1!="200" && $1!="EMBED_OFF"' "$OUT/results.tsv")
soft=$(awk -F'\t' '$1=="200" && $2!="-" && $2+0>0 && $2+0<1000 {print}' "$OUT/results.tsv")

if [ -n "$bad" ]; then
  echo; echo "=== NOT OK (429 usually means this sweep rate-limited itself; recheck serially) ==="
  echo "$bad"
fi
if [ -n "$soft" ]; then
  echo; echo "=== SUSPICIOUS: 200 but body under 1KB, likely a JS redirect stub ==="
  echo "$soft"
fi
[ -z "$bad" ] && echo && echo "all reachable."
echo
echo "full results: $OUT/results.tsv"
