#!/usr/bin/env bash
# Использование: scripts/new_episode.sh <slug> [YYYY-MM-DD]
set -e
cd "$(dirname "$0")/.."
SLUG="${1:?slug}"; DATE="${2:-$(date +%F)}"
DST="episodes/${DATE}_${SLUG}"
[ -e "$DST" ] && { echo "уже есть: $DST"; exit 1; }
cp -R episodes/_template "$DST"
echo "создано: $DST"
