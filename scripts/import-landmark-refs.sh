#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <urls-file> [gender] [ethnicity]"
  exit 1
fi

URL_FILE="$1"
GENDER="${2:-male}"
ETHNICITY="${3:-white}"
OUT_DIR="public/landmarks/${GENDER}/${ETHNICITY}"

mkdir -p "$OUT_DIR"

mapfile -t URLS < <(grep -Eo 'https?://[^[:space:]]+' "$URL_FILE" | grep '/images/landmarks/' || true)

if [ "${#URLS[@]}" -eq 0 ]; then
  echo "No landmark URLs found in ${URL_FILE}"
  exit 0
fi

declare -A seen
for raw in "${URLS[@]}"; do
  clean="${raw%%\?*}"
  file_name="$(basename "$clean")"
  if [ -z "$file_name" ]; then
    continue
  fi
  if [[ -n "${seen[$file_name]:-}" ]]; then
    continue
  fi
  seen[$file_name]=1

  out="${OUT_DIR}/${file_name}"
  echo "Downloading ${file_name}"
  curl -fsSL "$raw" -o "$out" || echo "Failed: $raw"
done

echo "Saved ${#seen[@]} files to ${OUT_DIR}"
